# Knowledge Base Quality Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/understand-kb` so it keeps the same-or-greater document coverage while making each document more detailed, evidence-graded, and readable for non-technical business users.

**Architecture:** Add an evidence model to business fact extraction, group capabilities by evidence strength, reuse a small Markdown quality module for writer outputs and generated reports, then update deterministic renderers and writer prompts to follow the detailed reader contract. Keep the fixed writer pool and memory caps unchanged; quality comes from better context and validation, not from launching more workers.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, Markdown prompt files, `/understand-kb` Node CLI script.

---

## Scope Check

This is one coherent subsystem: knowledge-base generation. It touches extraction, writer validation, rendering, prompts, and CLI reporting, but all changes serve the same output contract.

The implementation must avoid unrelated dashboard files and must not modify generated `.understand-code/` output except during manual verification.

## File Structure

- Modify: `packages/core/src/knowledge-base/types.ts`
  - Add evidence source, role, confidence, quality summary, and capability evidence fields.
- Modify: `packages/core/src/knowledge-base/business-facts.ts`
  - Classify each fact by evidence provenance and keep domain terms such as `注册表单`, `表单校验`, and `默认选项`.
- Create: `packages/core/src/knowledge-base/quality.ts`
  - Share section parsing, generic phrase detection, evidence-reference checks, and document quality summaries.
- Modify: `packages/core/src/knowledge-base/index.ts`
  - Export the quality helpers for tests and reporting.
- Modify: `packages/core/src/knowledge-base/writer-contracts.ts`
  - Reject thin or generic writer output, not just malformed JSON or missing headings.
- Modify: `packages/core/src/knowledge-base/markdown.ts`
  - Render richer deterministic file/topic/business docs, evidence grades, capability categories, and quality report fields.
- Modify: `skills/understand-kb/generate-knowledge-base.mjs`
  - Print quality status alongside coverage status.
- Modify: `agents/kb-file-writer.md`
  - Require business-reader sections and evidence-grade-aware explanations.
- Modify: `agents/kb-topic-writer.md`
  - Require topic docs to explain business purpose, inputs/outputs, trigger rules, fallbacks, and code evidence.
- Modify: `skills/understand-kb/SKILL.md`
  - Document the quality-first run posture without increasing worker fan-out.
- Modify: `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`
  - Cover evidence provenance, term preservation, capability grouping, and generated business docs.
- Modify: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`
  - Cover semantic rejection of empty/generic docs and acceptance of detailed docs.
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
  - Cover document count preservation and quality report presence.

### Task 1: Add Evidence Types And Source Classification

**Files:**
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/business-facts.ts`
- Test: `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`

- [ ] **Step 1: Write the failing evidence provenance test**

Append this test inside `describe("business fact extraction", () => { ... })` in `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`.

```ts
it("grades business evidence by source provenance and keeps domain terms", () => {
  const graph = formGraph();
  graph.nodes.push(
    {
      id: "file:src/strategy.ts",
      type: "file",
      name: "strategy.ts",
      filePath: "src/strategy.ts",
      summary: "表单校验与默认选项策略",
      tags: ["strategy", "business"],
      complexity: "complex",
    },
    {
      id: "function:src/strategy.ts:applyStrategy",
      type: "function",
      name: "applyStrategy",
      filePath: "src/strategy.ts",
      lineRange: [1, 8],
      summary: "命中表单校验后执行默认选项",
      tags: ["strategy", "business"],
      complexity: "complex",
    },
    {
      id: "file:agents/kb-file-writer.md",
      type: "file",
      name: "kb-file-writer.md",
      filePath: "agents/kb-file-writer.md",
      summary: "writer prompt example",
      tags: ["prompt"],
      complexity: "simple",
    },
  );
  graph.edges.push({
    source: "file:src/strategy.ts",
    target: "function:src/strategy.ts:applyStrategy",
    type: "contains",
    direction: "forward",
    weight: 1,
  });

  const profile = buildKnowledgeBaseProfile(graph);
  const plan = buildFileDocPlan(profile, {
    sourceFiles: {
      "src/strategy.ts": [
        "export function applyStrategy(ctx: Ctx): string {",
        "  // 表单校验：默认选项策略命中后默认选中跨品类推荐",
        "  if (ctx.enableMultiCategoryPenetration && ctx.defaultChecked) return '默认选项';",
        "  return 'manual';",
        "}",
      ].join("\n"),
      "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
      "agents/kb-file-writer.md": "Example: 注册表单 and 默认选项 should be explained when source evidence supports them.",
    },
  });

  const productionTask = plan.tasks.find((item) => item.filePath === "src/strategy.ts");
  const testTask = plan.tasks.find((item) => item.filePath === "src/formtype.test.ts");
  const promptTask = plan.tasks.find((item) => item.filePath === "agents/kb-file-writer.md");

  expect(productionTask).toBeDefined();
  expect(testTask).toBeDefined();
  expect(promptTask).toBeDefined();

  const productionFacts = extractBusinessFactsFromFileTask(profile, productionTask!);
  const testFacts = extractBusinessFactsFromFileTask(profile, testTask!);
  const promptFacts = extractBusinessFactsFromFileTask(profile, promptTask!);

  expect(productionFacts.some((fact) => fact.sourceKind === "production-logic")).toBe(true);
  expect(productionFacts.some((fact) => fact.evidenceRole === "primary")).toBe(true);
  expect(productionFacts.flatMap((fact) => fact.keywords)).toEqual(expect.arrayContaining(["表单校验", "默认选项"]));
  expect(productionFacts.every((fact) => fact.businessMeaning.length > 8)).toBe(true);

  expect(testFacts.some((fact) => fact.sourceKind === "test")).toBe(true);
  expect(testFacts.every((fact) => fact.evidenceRole === "supporting")).toBe(true);
  expect(testFacts.some((fact) => fact.riskFlags.includes("test-only"))).toBe(true);

  expect(promptFacts.some((fact) => fact.sourceKind === "prompt-or-tooling-example")).toBe(true);
  expect(promptFacts.every((fact) => fact.evidenceRole === "example-only")).toBe(true);
  expect(promptFacts.some((fact) => fact.riskFlags.includes("prompt-only"))).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts
```

Expected: FAIL with TypeScript or assertion errors for missing `sourceKind`, `evidenceRole`, `confidence`, `businessMeaning`, and `riskFlags`.

- [ ] **Step 3: Add evidence types**

In `packages/core/src/knowledge-base/types.ts`, extend the business fact and capability types with these definitions.

```ts
export type BusinessEvidenceSourceKind =
  | "production-logic"
  | "configuration"
  | "comment"
  | "test"
  | "documentation"
  | "prompt-or-tooling-example"
  | "graph-structure";

export type BusinessEvidenceRole = "primary" | "supporting" | "example-only";
export type BusinessEvidenceConfidence = "high" | "medium" | "low";

export interface BusinessEvidenceSummary {
  sourceKind: BusinessEvidenceSourceKind;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  businessMeaning: string;
  riskFlags: string[];
}
```

Update `BusinessFact`:

```ts
export interface BusinessFact {
  id: string;
  kind: BusinessFactKind;
  title: string;
  summary: string;
  keywords: string[];
  relatedNodeIds: string[];
  evidence: SourceEvidence[];
  score: number;
  sourceKind: BusinessEvidenceSourceKind;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  businessMeaning: string;
  riskFlags: string[];
}
```

Update `BusinessCapability`:

```ts
export interface BusinessCapability {
  id: string;
  title: string;
  keywords: string[];
  factIds: string[];
  relatedNodeIds: string[];
  evidence: SourceEvidence[];
  score: number;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  sourceKindCounts: Partial<Record<BusinessEvidenceSourceKind, number>>;
  primaryFactIds: string[];
  supportingFactIds: string[];
  exampleOnlyFactIds: string[];
}
```

- [ ] **Step 4: Replace broad keyword lists with a business lexicon**

In `packages/core/src/knowledge-base/business-facts.ts`, replace `BUSINESS_WORDS` and `HIGH_SIGNAL_WORDS` with this narrower lexicon. Keep `formtype`, but remove generic `type` and generic `test` as business terms.

```ts
const BUSINESS_LEXICON = [
  "业务",
  "表单",
  "注册表单",
  "导流",
  "订单",
  "策略",
  "规则",
  "实验",
  "配额",
  "命中",
  "场景",
  "召回",
  "推荐",
  "降级",
  "文案",
  "过滤",
  "准入",
  "表单校验",
  "默认选项",
  "form",
  "formtype",
  "strategy",
  "rule",
  "quota",
  "scene",
  "experiment",
  "ranking",
] as const;

const HIGH_SIGNAL_WORDS = [
  "注册表单",
  "表单校验",
  "默认选项",
  "表单",
  "form",
  "formtype",
  "strategy",
  "quota",
  "experiment",
  "策略",
  "规则",
  "实验",
  "配额",
] as const;
```

- [ ] **Step 5: Add evidence classification helpers**

In `packages/core/src/knowledge-base/business-facts.ts`, first extend the type import from `./types.js`.

```ts
import type {
  BusinessCapability,
  BusinessCapabilityProfile,
  BusinessEvidenceConfidence,
  BusinessEvidenceRole,
  BusinessEvidenceSourceKind,
  BusinessFact,
  BusinessFactKind,
  FileDocPlan,
  FileDocTask,
  ProjectProfile,
  SourceEvidence,
} from "./types.js";
```

Then add these helpers near the existing text helpers.

```ts
function isTestPath(filePath: string): boolean {
  return /(^|[/\\])(__tests__|test|tests)([/\\]|$)|(?:test|spec)\.[^.]+$/i.test(filePath);
}

function isDocumentationPath(filePath: string): boolean {
  return /(^|[/\\])(docs?|design|adr|review)([/\\]|$)|\.(md|mdx|txt)$/i.test(filePath);
}

function isPromptOrToolingPath(filePath: string): boolean {
  return /(^|[/\\])(agents|skills|prompts|fixtures)([/\\]|$)|generate-knowledge-base\.mjs$|business-facts\.ts$/i.test(filePath);
}

function sourceKindFor(filePath: string, kind: BusinessFactKind): BusinessEvidenceSourceKind {
  if (kind === "config") return "configuration";
  if (kind === "document") return "documentation";
  if (kind === "graph-node") return "graph-structure";
  if (isPromptOrToolingPath(filePath)) return "prompt-or-tooling-example";
  if (isTestPath(filePath) || kind === "test") return "test";
  if (isDocumentationPath(filePath)) return "documentation";
  if (kind === "comment") return "comment";
  if (kind === "constant" || kind === "branch") return "production-logic";
  return "graph-structure";
}

function roleForSourceKind(sourceKind: BusinessEvidenceSourceKind): BusinessEvidenceRole {
  if (sourceKind === "production-logic" || sourceKind === "configuration") return "primary";
  if (sourceKind === "prompt-or-tooling-example") return "example-only";
  return "supporting";
}

function confidenceForSourceKind(sourceKind: BusinessEvidenceSourceKind): BusinessEvidenceConfidence {
  if (sourceKind === "production-logic" || sourceKind === "configuration") return "high";
  if (sourceKind === "comment" || sourceKind === "test" || sourceKind === "documentation") return "medium";
  return "low";
}

function riskFlagsForSourceKind(sourceKind: BusinessEvidenceSourceKind): string[] {
  if (sourceKind === "test") return ["test-only"];
  if (sourceKind === "prompt-or-tooling-example") return ["prompt-only"];
  if (sourceKind === "comment") return ["comment-only"];
  if (sourceKind === "graph-structure") return ["graph-only"];
  return [];
}

function businessMeaningFor(kind: BusinessFactKind, line: string, sourceKind: BusinessEvidenceSourceKind): string {
  const title = titleFromLine(line);
  if (sourceKind === "production-logic") return `生产代码中出现的业务规则或分支：${title}`;
  if (sourceKind === "configuration") return `配置或常量证据描述了可调整的业务规则：${title}`;
  if (sourceKind === "test") return `测试样例覆盖了该业务场景，但仍需生产代码共同确认：${title}`;
  if (sourceKind === "prompt-or-tooling-example") return `工具或提示词中的示例业务词，只能作为抽取样例：${title}`;
  if (kind === "comment") return `代码注释说明了业务意图：${title}`;
  return `图谱或文档中出现的业务线索：${title}`;
}
```

- [ ] **Step 6: Populate evidence fields in facts**

In `makeFact`, compute and include the new fields.

```ts
const sourceKind = sourceKindFor(task.filePath, kind);
const evidenceRole = roleForSourceKind(sourceKind);
const confidence = confidenceForSourceKind(sourceKind);
const riskFlags = riskFlagsForSourceKind(sourceKind);
```

Return these fields in the `BusinessFact` object:

```ts
sourceKind,
evidenceRole,
confidence,
businessMeaning: businessMeaningFor(kind, line, sourceKind),
riskFlags,
```

In `factFromNode`, compute equivalent fields from `node.filePath ?? node.name` and `kind`.

```ts
const sourceKind = sourceKindFor(node.filePath ?? node.name, kind);
const evidenceRole = roleForSourceKind(sourceKind);
const confidence = confidenceForSourceKind(sourceKind);
```

- [ ] **Step 7: Run the focused test and verify it passes**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/business-facts.ts packages/core/src/knowledge-base/__tests__/business-facts.test.ts
git commit -m "feat: grade knowledge base business evidence"
```

### Task 2: Make Capability Grouping Evidence-Aware

**Files:**
- Modify: `packages/core/src/knowledge-base/business-facts.ts`
- Test: `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`

- [ ] **Step 1: Write failing capability role tests**

Add these tests to `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`.

```ts
it("marks prompt-only business terms as example-only capabilities", () => {
  const graph = formGraph();
  graph.nodes = [
    {
      id: "file:agents/kb-file-writer.md",
      type: "file",
      name: "kb-file-writer.md",
      filePath: "agents/kb-file-writer.md",
      summary: "注册表单 writer example",
      tags: ["prompt", "formtype"],
      complexity: "simple",
    },
  ];
  graph.edges = [];
  graph.layers = [{
    id: "layer:prompt",
    name: "Prompt",
    description: "writer examples",
    nodeIds: ["file:agents/kb-file-writer.md"],
  }];

  const profile = buildKnowledgeBaseProfile(graph);
  const fileDocPlan = buildFileDocPlan(profile, {
    sourceFiles: {
      "agents/kb-file-writer.md": "Example: 注册表单 命中后解释表单校验和默认选项。",
    },
  });

  const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
  const capability = capabilityProfile.capabilities.find((item) =>
    item.keywords.includes("注册表单") || item.keywords.includes("默认选项")
  );

  expect(capability).toBeDefined();
  expect(capability?.evidenceRole).toBe("example-only");
  expect(capability?.confidence).toBe("low");
  expect(capability?.primaryFactIds).toEqual([]);
  expect(capability?.exampleOnlyFactIds.length).toBeGreaterThan(0);
});

it("promotes capabilities when production or configuration evidence exists", () => {
  const profile = buildKnowledgeBaseProfile(formGraph());
  const fileDocPlan = buildFileDocPlan(profile, {
    sourceFiles: {
      "src/formtype.ts": [
        "// 注册表单: 用户注册表单",
        "const RegistrationFormType = 101;",
        "switch (ctx.formType) { case 101: return RegistrationFormType; }",
      ].join("\n"),
      "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
    },
  });

  const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
  const capability = capabilityProfile.capabilities.find((item) =>
    item.title.includes("注册表单") || item.keywords.includes("formtype")
  );

  expect(capability).toBeDefined();
  expect(capability?.evidenceRole).toBe("primary");
  expect(capability?.confidence).toBe("high");
  expect(capability?.primaryFactIds.length).toBeGreaterThan(0);
  expect(capability?.sourceKindCounts["production-logic"]).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts
```

Expected: FAIL because capabilities do not yet expose `evidenceRole`, `confidence`, source kind counts, or fact buckets.

- [ ] **Step 3: Add capability aggregation helpers**

In `packages/core/src/knowledge-base/business-facts.ts`, add helpers above `buildCapabilities`.

```ts
function capabilityRoleForFacts(facts: BusinessFact[]): BusinessEvidenceRole {
  if (facts.some((fact) => fact.evidenceRole === "primary")) return "primary";
  if (facts.some((fact) => fact.evidenceRole === "supporting")) return "supporting";
  return "example-only";
}

function capabilityConfidenceForFacts(facts: BusinessFact[]): BusinessEvidenceConfidence {
  if (facts.some((fact) => fact.confidence === "high")) return "high";
  if (facts.some((fact) => fact.confidence === "medium")) return "medium";
  return "low";
}

function sourceKindCountsForFacts(facts: BusinessFact[]): Partial<Record<BusinessEvidenceSourceKind, number>> {
  const counts: Partial<Record<BusinessEvidenceSourceKind, number>> = {};
  for (const fact of facts) {
    counts[fact.sourceKind] = (counts[fact.sourceKind] ?? 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 4: Return evidence-aware capability fields**

Inside the `map(([key, group]) => { ... })` block in `buildCapabilities`, add these values before the returned object.

```ts
const primaryFactIds = group.filter((fact) => fact.evidenceRole === "primary").map((fact) => fact.id).sort();
const supportingFactIds = group.filter((fact) => fact.evidenceRole === "supporting").map((fact) => fact.id).sort();
const exampleOnlyFactIds = group.filter((fact) => fact.evidenceRole === "example-only").map((fact) => fact.id).sort();
```

Include these fields in the returned `BusinessCapability`.

```ts
evidenceRole: capabilityRoleForFacts(group),
confidence: capabilityConfidenceForFacts(group),
sourceKindCounts: sourceKindCountsForFacts(group),
primaryFactIds,
supportingFactIds,
exampleOnlyFactIds,
```

- [ ] **Step 5: Make score reflect evidence role without dropping docs**

Replace the score computation in `buildCapabilities` with this form so primary evidence ranks first, but example-only groups are still visible.

```ts
const roleBoost = capabilityRoleForFacts(group) === "primary"
  ? 50
  : capabilityRoleForFacts(group) === "supporting"
    ? 20
    : 0;
const score = group.reduce((sum, fact) => sum + fact.score, 0) + group.length * 3 + roleBoost;
```

- [ ] **Step 6: Run the focused tests**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/core/src/knowledge-base/business-facts.ts packages/core/src/knowledge-base/__tests__/business-facts.test.ts
git commit -m "feat: group business capabilities by evidence strength"
```

### Task 3: Add Shared Markdown Quality Validation

**Files:**
- Create: `packages/core/src/knowledge-base/quality.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`
- Modify: `packages/core/src/knowledge-base/writer-contracts.ts`
- Test: `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`

- [ ] **Step 1: Replace the complete file sample with a detailed sample**

In `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`, replace `completeFileMarkdown()` with this detailed version.

```ts
function completeFileMarkdown(): string {
  return [
    "# src/service/feed.ts",
    "",
    "## 非技术同学速读",
    "这个文件负责把候选内容组织成最终 feed 结果，影响用户看到的内容顺序和可解释性。",
    "",
    "## 文件职责",
    "该文件承接入口请求，读取候选内容，应用排序规则，并把结果交给响应渲染层。",
    "",
    "## 业务问题与影响对象",
    "它解决的是请求进来后如何从候选集合中挑选、排序并返回内容的问题。受影响对象包括终端用户、运营策略配置和调用 feed 接口的上游服务。",
    "",
    "## 所属位置",
    "Service layer，位于接口入口和候选数据读取之间。",
    "",
    "## 文件内结构",
    "包含 `BuildFeed` 主编排函数、`rankCandidates` 排序函数和 `FeedBuilder` 协调类。",
    "",
    "## 关键规则、输入输出与兜底",
    "输入是请求上下文和候选数据；输出是有序 feed。候选为空时需要返回空结果，排序配置缺失时按默认分值处理。",
    "",
    "## 函数卡片",
    "### BuildFeed\n- 节点 ID: `function:src/service/feed.ts:BuildFeed`\n- 位置: `src/service/feed.ts`:30-90\n- 职责: 读取候选并调用排序，决定 feed 返回内容。\n- 输入/依赖: 请求上下文、候选存储、排序配置。\n- 输出/副作用: 返回排序后的 feed，可能记录调试指标。\n- 上游调用: `HandleFeedRequest`。\n- 下游调用: `LoadCandidates`、`rankCandidates`。\n- 业务含义: 改变它会影响用户看到的内容和运营策略命中效果。\n- 注意事项: 修改排序或兜底时必须核对配置和测试样例。\n- 代码证据: `src/service/feed.ts`:30-90",
    "",
    "## 类卡片",
    "### FeedBuilder\n- 节点 ID: `class:src/service/feed.ts:FeedBuilder`\n- 位置: `src/service/feed.ts`:122-180\n- 职责: 保存构建过程中的上下文并协调多个步骤。\n- 关联入口/依赖: `BuildFeed` 创建并使用它。\n- 代码证据: `src/service/feed.ts`:122-180",
    "",
    "## 调用关系",
    "`BuildFeed` 由 `HandleFeedRequest` 调用，并继续调用 `LoadCandidates` 与 `rankCandidates`。",
    "",
    "## 风险点与待确认项",
    "排序权重、候选为空和配置缺失是主要风险；线上配置值和真实流量命中比例需要平台侧确认。",
    "",
    "## 代码证据",
    "- `src/service/feed.ts`:30-90\n- `src/service/feed.ts`:122-180",
    "",
    "## AI 检索词",
    "- feed, ranking, service, BuildFeed, FeedBuilder, src/service/feed.ts",
  ].join("\n");
}
```

- [ ] **Step 2: Add failing semantic validation tests**

Append these tests in `describe("writer contracts", () => { ... })`.

```ts
it("rejects file documents that satisfy headings but contain generic filler", () => {
  const output = completeFileOutput();
  output.documents[0].markdown = [
    "# src/service/feed.ts",
    "",
    ...FILE_WRITER_REQUIRED_SECTIONS.flatMap((section) => [
      section,
      "承担核心逻辑。根据代码推断，需线上配置确认。",
      "",
    ]),
  ].join("\n");

  const result = parseFileWriterBatchOutput(output);

  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(expect.arrayContaining([
    "documents[0].markdown has too much generic filler text",
    "documents[0].markdown does not explain enough source evidence",
  ]));
});

it("rejects file documents that omit covered function ids from the function card section", () => {
  const output = completeFileOutput();
  output.documents[0].markdown = output.documents[0].markdown.replace(
    "`function:src/service/feed.ts:BuildFeed`",
    "`function:src/service/feed.ts:OtherFunction`",
  );

  const result = parseFileWriterBatchOutput(output);

  expect(result.ok).toBe(false);
  expect(result.errors).toContain("documents[0].markdown missing covered function id: function:src/service/feed.ts:BuildFeed");
});
```

- [ ] **Step 3: Run writer contract tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: FAIL because the new required sections and semantic errors do not exist yet.

- [ ] **Step 4: Update required file sections**

In `packages/core/src/knowledge-base/writer-contracts.ts`, replace `FILE_WRITER_REQUIRED_SECTIONS` with:

```ts
export const FILE_WRITER_REQUIRED_SECTIONS = [
  "## 非技术同学速读",
  "## 文件职责",
  "## 业务问题与影响对象",
  "## 所属位置",
  "## 文件内结构",
  "## 关键规则、输入输出与兜底",
  "## 函数卡片",
  "## 类卡片",
  "## 调用关系",
  "## 风险点与待确认项",
  "## 代码证据",
  "## AI 检索词",
] as const;
```

In the same file, prepend `"## 非技术同学速读"` to `TOPIC_WRITER_REQUIRED_SECTIONS`.

- [ ] **Step 5: Create the quality helper module**

Create `packages/core/src/knowledge-base/quality.ts`.

```ts
export interface MarkdownQualityOptions {
  path: string;
  sections: readonly string[];
  sourceEvidenceRefs?: string[];
  coveredFunctionNodeIds?: string[];
  coveredClassNodeIds?: string[];
}

export interface MarkdownQualitySummary {
  checked: number;
  failed: string[];
  warnings: string[];
}

const GENERIC_FILLER = [
  "承担核心逻辑",
  "处理相关能力",
  "本地代码事实",
  "未在图谱中识别",
  "根据代码推断，需线上配置确认",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sectionBody(markdown: string, section: string): string {
  const heading = new RegExp(`^${escapeRegExp(section)}\\s*$`, "m");
  const match = heading.exec(markdown);
  if (!match) return "";
  const rest = markdown.slice(match.index + match[0].length);
  const nextHeadingIndex = rest.search(/^##\s/m);
  return (nextHeadingIndex >= 0 ? rest.slice(0, nextHeadingIndex) : rest).trim();
}

function countGenericFiller(markdown: string): number {
  return GENERIC_FILLER.reduce((sum, phrase) => {
    return sum + (markdown.match(new RegExp(escapeRegExp(phrase), "g"))?.length ?? 0);
  }, 0);
}

export function validateMarkdownQuality(markdown: string, options: MarkdownQualityOptions): string[] {
  const errors: string[] = [];
  const genericCount = countGenericFiller(markdown);
  if (genericCount >= 4) errors.push(`${options.path} has too much generic filler text`);

  const shortSections = options.sections.filter((section) => sectionBody(markdown, section).replace(/\s+/g, "").length < 18);
  for (const section of shortSections) {
    errors.push(`${options.path} section ${section} is too thin`);
  }

  const evidenceRefs = options.sourceEvidenceRefs ?? [];
  if (evidenceRefs.length > 0 && !evidenceRefs.some((ref) => markdown.includes(ref))) {
    errors.push(`${options.path} does not explain enough source evidence`);
  }

  for (const nodeId of options.coveredFunctionNodeIds ?? []) {
    if (!sectionBody(markdown, "## 函数卡片").includes(nodeId)) {
      errors.push(`${options.path} missing covered function id: ${nodeId}`);
    }
  }

  for (const nodeId of options.coveredClassNodeIds ?? []) {
    if (!sectionBody(markdown, "## 类卡片").includes(nodeId)) {
      errors.push(`${options.path} missing covered class id: ${nodeId}`);
    }
  }

  return errors;
}

export function summarizeMarkdownQuality(documents: Array<{ path: string; content: string }>): MarkdownQualitySummary {
  const failed = documents
    .filter((document) => countGenericFiller(document.content) >= 4)
    .map((document) => document.path)
    .sort();
  return {
    checked: documents.length,
    failed,
    warnings: failed.map((path) => `document has generic filler text: ${path}`),
  };
}
```

- [ ] **Step 6: Export the quality module**

In `packages/core/src/knowledge-base/index.ts`, add:

```ts
export * from "./quality.js";
```

- [ ] **Step 7: Wire semantic validation into writer contracts**

In `packages/core/src/knowledge-base/writer-contracts.ts`, import the helper.

```ts
import { validateMarkdownQuality } from "./quality.js";
```

Inside `validateFileWriterDocument`, after `validateNoPlaceholderText(...)`, add:

```ts
const evidenceRefs = Array.isArray(value.sourceEvidence)
  ? value.sourceEvidence
      .filter((item): item is { filePath: string } => isRecord(item) && typeof item.filePath === "string")
      .map((item) => item.filePath)
  : [];
errors.push(...validateMarkdownQuality(value.markdown, {
  path: `${path}.markdown`,
  sections: FILE_WRITER_REQUIRED_SECTIONS,
  sourceEvidenceRefs: evidenceRefs,
  coveredFunctionNodeIds: Array.isArray(value.coveredFunctionNodeIds) ? value.coveredFunctionNodeIds.filter((item): item is string => typeof item === "string") : [],
  coveredClassNodeIds: Array.isArray(value.coveredClassNodeIds) ? value.coveredClassNodeIds.filter((item): item is string => typeof item === "string") : [],
}));
```

Inside `validateTopicWriterDocument`, after `validateNoPlaceholderText(...)`, add:

```ts
const evidenceRefs = Array.isArray(value.evidence)
  ? value.evidence
      .filter((item): item is { filePath: string } => isRecord(item) && typeof item.filePath === "string")
      .map((item) => item.filePath)
  : [];
errors.push(...validateMarkdownQuality(value.markdown, {
  path: `${path}.markdown`,
  sections: TOPIC_WRITER_REQUIRED_SECTIONS,
  sourceEvidenceRefs: evidenceRefs,
}));
```

- [ ] **Step 8: Run writer contract tests**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add packages/core/src/knowledge-base/quality.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/writer-contracts.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
git commit -m "feat: validate knowledge base document quality"
```

### Task 4: Render Detailed Business And Deterministic Documents

**Files:**
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `skills/understand-kb/generate-knowledge-base.mjs`
- Test: `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`
- Test: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add failing generated-doc quality assertions**

In `packages/core/src/knowledge-base/__tests__/business-facts.test.ts`, extend the existing `"generates business capability documents and coverage from extracted facts"` test with these assertions.

```ts
expect(index?.content).toContain("证据分组");
expect(index?.content).toContain("primary");

expect(capabilityDoc?.content).toContain("## 非技术同学速读");
expect(capabilityDoc?.content).toContain("## 业务问题与影响对象");
expect(capabilityDoc?.content).toContain("## 关键规则与触发条件");
expect(capabilityDoc?.content).toContain("## 证据分级");
expect(capabilityDoc?.content).toContain("证据等级");
expect(capabilityDoc?.content).toContain("production-logic");

expect(kb.coverageReport.qualityValidation.checked).toBeGreaterThan(0);
expect(report?.content).toContain("质量校验");
```

In `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`, add this assertion to the main generated knowledge-base test that already checks coverage counts.

```ts
expect(kb.documents.length).toBeGreaterThanOrEqual(kb.coverageReport.totalDocuments);
expect(kb.coverageReport.qualityValidation.checked).toBe(kb.coverageReport.totalDocuments);
```

- [ ] **Step 2: Run focused generated-doc tests and verify failure**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: FAIL because rendered docs and `CoverageReport` do not yet include quality details.

- [ ] **Step 3: Add quality summary to the coverage type**

In `packages/core/src/knowledge-base/types.ts`, add:

```ts
export interface DocumentQualityValidation {
  checked: number;
  failed: string[];
  warnings: string[];
}
```

Add this field to `CoverageReport`:

```ts
qualityValidation: DocumentQualityValidation;
```

- [ ] **Step 4: Add labels and quality summary to markdown rendering**

In `packages/core/src/knowledge-base/markdown.ts`, import:

```ts
import { summarizeMarkdownQuality } from "./quality.js";
```

Add these label helpers near the other label helpers.

```ts
function evidenceRoleLabel(role: string): string {
  if (role === "primary") return "primary / 生产或配置主证据";
  if (role === "supporting") return "supporting / 支撑证据";
  if (role === "example-only") return "example-only / 示例证据";
  return role;
}

function confidenceLabel(confidence: string): string {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  if (confidence === "low") return "低";
  return confidence;
}
```

Inside `buildCoverageReport`, compute:

```ts
const qualityValidation = summarizeMarkdownQuality(documents);
```

Include it in the returned report:

```ts
qualityValidation,
```

Append quality warnings into the existing warnings calculation:

```ts
const warnings = [...new Set([...validation.warnings, ...evidenceWarnings, ...qualityValidation.warnings])].sort();
```

- [ ] **Step 5: Render richer business capability index and documents**

In `renderBusinessCapabilityDocuments`, update the index table to include evidence grouping.

```ts
"## 证据分组",
"",
"| 业务能力 | 证据等级 | 可信度 | 主证据数 | 支撑证据数 | 示例证据数 | 关键词 |",
"|---|---|---|---:|---:|---:|---|",
```

Push rows with:

```ts
`| [${capability.title}](${businessCapabilityDocumentPath(capability.title, capability.id)}) | ${capability.evidenceRole} | ${capability.confidence} | ${capability.primaryFactIds.length} | ${capability.supportingFactIds.length} | ${capability.exampleOnlyFactIds.length} | ${capability.keywords.join("、")} |`
```

Replace each capability document body with sections that answer the reader contract.

```ts
const lines = [
  `# ${capability.title}`,
  "",
  "## 非技术同学速读",
  "",
  `这个能力聚合了 ${facts.length} 条代码事实，当前证据等级为 ${evidenceRoleLabel(capability.evidenceRole)}，可信度为${confidenceLabel(capability.confidence)}。`,
  "",
  "## 业务问题与影响对象",
  "",
  `它围绕 ${capability.keywords.join("、") || capability.title} 这些业务词展开，影响相关代码路径中的策略判断、配置解释或测试样例。`,
  "",
  "## 关键规则与触发条件",
  "",
];
```

For primary and supporting facts, render rule bullets with source kind:

```ts
for (const fact of facts.filter((item) => item.evidenceRole !== "example-only")) {
  const evidence = fact.evidence[0];
  lines.push(`- **${fact.title}**：${fact.businessMeaning}；证据等级=${fact.sourceKind}/${fact.evidenceRole}/${fact.confidence}；位置=\`${evidence?.filePath ?? ""}\`${evidence?.lineRange ? `:${evidence.lineRange.join("-")}` : ""}`);
}
if (!facts.some((item) => item.evidenceRole !== "example-only")) {
  lines.push("- 未发现生产代码或配置主证据；当前只能作为示例或低可信线索保留。");
}
```

Then add these sections before the existing associated node list:

```ts
lines.push("");
lines.push("## 输入、输出与兜底");
lines.push("");
lines.push("- 输入、输出和兜底行为需要结合关联文件文档确认；本页只汇总跨文件业务证据。");
lines.push("");
lines.push("## 证据分级");
lines.push("");
lines.push("| 证据等级 | 来源类型 | 事实 | 位置 | 摘录 |");
lines.push("|---|---|---|---|---|");
for (const fact of facts) {
  const evidence = fact.evidence[0];
  lines.push(`| ${fact.evidenceRole}/${fact.confidence} | ${fact.sourceKind} | ${fact.title} | \`${evidence?.filePath ?? ""}\`${evidence?.lineRange ? `:${evidence.lineRange.join("-")}` : ""} | ${evidence?.excerpt ?? fact.summary} |`);
}
lines.push("");
lines.push("## 修改风险");
lines.push("");
lines.push("- 修改前需要确认生产代码、配置、测试样例和文档是否描述同一业务含义。");
lines.push("- 示例证据不能单独证明线上业务行为。");
```

- [ ] **Step 6: Render deterministic file docs with detailed sections**

In `renderDeterministicFileWriterDocument`, add the new sections required by `FILE_WRITER_REQUIRED_SECTIONS`. The `markdown` array should include these blocks before the existing file structure.

```ts
"## 非技术同学速读",
`这个文件在知识库中作为 ${NODE_TYPE_LABELS[nodeOf(profile, task.fileNodeId)?.type ?? "file"]} 节点出现，影响 ${task.functionNodeIds.length} 个函数和 ${task.classNodeIds.length} 个类的说明。`,
"",
"## 业务问题与影响对象",
task.functionNodeIds.length > 0 || task.classNodeIds.length > 0
  ? "本文件的影响对象包括调用这些函数或类的上游模块，以及依赖其输出结果的下游模块。具体业务含义需要结合函数卡片和代码证据阅读。"
  : "本文件没有函数或类节点；它仍然保留为覆盖文档，用来解释文件在图谱中的位置和证据缺口。",
"",
```

Add the input/output section before function cards:

```ts
"## 关键规则、输入输出与兜底",
[
  `- 上游关系数: ${task.incomingEdgeIds.length}`,
  `- 下游关系数: ${task.outgoingEdgeIds.length}`,
  task.sourceSnapshot.exists
    ? "- 源码已读取；具体规则以函数卡片和代码证据为准。"
    : "- 源码缺失；本页只能基于图谱关系说明，不能证明具体业务规则。",
].join("\n"),
"",
```

Add a `## 代码证据` block before `## AI 检索词`.

```ts
"## 代码证据",
[`- \`${task.filePath}\``, ...task.functionNodeIds.map((nodeId) => `- ${lineRef(nodeOf(profile, nodeId) ?? {}, task.filePath)} ${nodeId}`)].join("\n"),
"",
```

- [ ] **Step 7: Render deterministic topic docs with a速读 section**

In `renderDeterministicTopicWriterDocument` and `renderTopicDoc`, add `## 非技术同学速读` after the title.

```ts
"## 非技术同学速读",
`这个专题解释 ${node?.name ?? topic.topicNodeId} 在代码流程中的业务位置、输入输出、上下游依赖和修改风险。`,
"",
```

- [ ] **Step 8: Render quality status in the report and CLI**

In `renderCoverageReport`, add a section after `## 校验结果`.

```ts
lines.push("");
lines.push("## 质量校验");
lines.push("");
lines.push(`- 已检查文档: ${report.qualityValidation.checked}`);
lines.push(`- 质量失败文档: ${report.qualityValidation.failed.length}`);
for (const path of report.qualityValidation.failed) {
  lines.push(`  - ${path}`);
}
```

In `skills/understand-kb/generate-knowledge-base.mjs`, update `printCoverage`.

```js
if (kb.coverageReport.qualityValidation) {
  const passed = kb.coverageReport.qualityValidation.checked - kb.coverageReport.qualityValidation.failed.length;
  console.log(`质量校验: ${passed} / ${kb.coverageReport.qualityValidation.checked}`);
}
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 4**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/markdown.ts skills/understand-kb/generate-knowledge-base.mjs packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts
git commit -m "feat: render detailed evidence-graded knowledge docs"
```

### Task 5: Update Writer Prompts And Run Guidance

**Files:**
- Modify: `agents/kb-file-writer.md`
- Modify: `agents/kb-topic-writer.md`
- Modify: `skills/understand-kb/SKILL.md`

- [ ] **Step 1: Update the file writer required sections**

In `agents/kb-file-writer.md`, replace the `## Required Markdown Sections` list with:

```markdown
Every `markdown` value must include:

- `## 非技术同学速读`
- `## 文件职责`
- `## 业务问题与影响对象`
- `## 所属位置`
- `## 文件内结构`
- `## 关键规则、输入输出与兜底`
- `## 函数卡片`
- `## 类卡片`
- `## 调用关系`
- `## 风险点与待确认项`
- `## 代码证据`
- `## AI 检索词`
```

- [ ] **Step 2: Add file writer quality rules**

In `agents/kb-file-writer.md`, add this section after `## Hard Rules`.

```markdown
## Quality Rules

- Write for non-technical business readers first, then preserve engineering evidence.
- Explain what business problem the file solves, who or what scenario is affected, and why the file exists.
- For every important function, describe inputs, outputs, decision points, side effects, fallbacks, and business impact.
- If the input includes evidence records with `sourceKind`, `evidenceRole`, or `confidence`, show those grades in the relevant section.
- Do not use generic filler such as `承担核心逻辑`, `处理相关能力`, or repeated `根据代码推断，需线上配置确认` without explaining the concrete uncertainty.
- If evidence is weak, say what is missing and what can still be safely concluded from the code.
```

- [ ] **Step 3: Update topic writer required sections**

In `agents/kb-topic-writer.md`, add `## 非技术同学速读` to the required section list and include this expectation:

```markdown
- `## 非技术同学速读`: explain the topic in plain business language before technical details.
```

- [ ] **Step 4: Add topic writer quality rules**

In `agents/kb-topic-writer.md`, add this section after `## Hard Rules`.

```markdown
## Quality Rules

- Explain the business purpose, affected scenario, trigger conditions, inputs, outputs, fallbacks, and modification risks.
- Use linked file documents and source evidence to avoid unsupported claims.
- Preserve business terms from source code, including terms like `注册表单`, `表单校验`, and `默认选项`, when evidence is present.
- Label inferred or low-confidence behavior in `## 修改风险`.
- Do not reduce the required coverage of topic nodes.
```

- [ ] **Step 5: Update `/understand-kb` guidance**

In `skills/understand-kb/SKILL.md`, add this note under queue control or memory safety instructions.

```markdown
2.75. Preserve quality without increasing fan-out.
   - Keep `$PARALLEL_LIMIT` at `1` or `2`.
   - Higher document quality should come from evidence packets, detailed writer prompts, and contract validation.
   - Do not create extra ad-hoc writer workers to make the run appear faster.
   - If a writer batch fails quality validation, retry the leased batch with the concrete validation reason.
```

Update the final reporting list to include:

```markdown
    - Quality validation pass count from script output.
```

- [ ] **Step 6: Verify prompt text contains the new sections**

Run:

```bash
rg -n "非技术同学速读|业务问题与影响对象|关键规则、输入输出与兜底|Quality validation|质量" agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md
```

Expected: output contains all three modified files.

- [ ] **Step 7: Commit Task 5**

```bash
git add agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md
git commit -m "docs: require detailed knowledge base writer output"
```

### Task 6: Final Verification And Safe Sample Generation

**Files:**
- Verify only; no planned source edits unless tests expose a concrete issue.

- [ ] **Step 1: Run focused knowledge-base tests**

Run:

```bash
pnpm --filter @understand-code/core test -- packages/core/src/knowledge-base/__tests__/business-facts.test.ts packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full core tests**

Run:

```bash
pnpm --filter @understand-code/core test
```

Expected: PASS.

- [ ] **Step 3: Build core**

Run:

```bash
pnpm --filter @understand-code/core build
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run a bounded deterministic sample**

Run against the current repository with a conservative source cap.

```bash
node skills/understand-kb/generate-knowledge-base.mjs /Users/example/understand-code --deterministic-only --allow-large-deterministic --max-source-mb 32
```

Expected output includes:

```text
知识库已生成: /Users/example/understand-code/.understand-code/knowledge-base
生成 Markdown 文档数:
覆盖状态:
质量校验:
文件文档覆盖:
函数卡片覆盖:
类卡片覆盖:
业务事实覆盖:
业务能力文档:
```

- [ ] **Step 5: Inspect representative generated docs**

Run:

```bash
rg -n "非技术同学速读|证据分级|业务问题与影响对象|质量校验" /Users/example/understand-code/.understand-code/knowledge-base/业务能力索引.md /Users/example/understand-code/.understand-code/knowledge-base/覆盖报告.md /Users/example/understand-code/.understand-code/knowledge-base/业务能力
```

Expected: output shows the richer sections in the business index, coverage report, and business capability docs.

- [ ] **Step 6: Confirm document count did not shrink for the same graph**

Run:

```bash
find /Users/example/understand-code/.understand-code/knowledge-base -name '*.md' | wc -l
```

Expected: count is greater than or equal to the previous deterministic baseline for the same graph. For the refreshed current graph, the earlier baseline was `644` Markdown docs.

- [ ] **Step 7: Check worktree scope**

Run:

```bash
git status --short
```

Expected: changes are limited to the planned knowledge-base core files, writer prompts, skill guidance, and generated sample output if the sample run was executed. Do not stage unrelated dashboard changes.

- [ ] **Step 8: Commit final verification fixes if needed**

Only run this if Steps 1-7 required small fixes after the task commits.

```bash
git add packages/core/src/knowledge-base agents/kb-file-writer.md agents/kb-topic-writer.md skills/understand-kb/SKILL.md skills/understand-kb/generate-knowledge-base.mjs
git commit -m "fix: tighten knowledge base quality verification"
```

## Acceptance Mapping

- Same-or-greater document count: Task 6 Step 6.
- Every doc has detailed business-reader structure: Tasks 3, 4, and 5.
- Important business terms preserved: Task 1 tests `注册表单`, `表单校验`, and `默认选项`.
- Prompt/tooling examples are not promoted as primary business truth: Task 2.
- Business capability docs show source evidence and confidence: Task 4.
- File docs and function cards explain concrete behavior: Tasks 3, 4, and 5.
- Thin documents fail validation: Task 3.
- Writer pool remains bounded: Task 5 keeps `/understand-kb` at `1` or `2`.
- Large runs remain memory-safe: Task 6 uses `--max-source-mb 32` for sample generation.
- Coverage report includes quality status: Task 4 and Task 6.
