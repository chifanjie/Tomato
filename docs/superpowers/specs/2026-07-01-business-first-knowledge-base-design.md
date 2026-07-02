# Business-First Knowledge Base Design

Status: Ready for user review
Date: 2026-07-01

## Background

The current `/understand-kb` pipeline already generates a broad Markdown knowledge base from `.understand-anything/knowledge-graph.json`. It plans file documents, topic documents, business capability documents, indexes, and coverage reports. It also keeps strong structural coverage by tracking files, functions, classes, graph edges, evidence anchors, and validation status.

The quality problem is not lack of coverage. The problem is that the generated Markdown reads like a graph audit and evidence report instead of a business knowledge base. Many pages contain phrases such as graph nodes, evidence grades, covered node ids, code evidence, and source evidence. Some pages are titled as business capabilities, but their titles and contents come from regexes, `if` statements, test snippets, prompt examples, or tool code. Flow documents can be extremely thin, sometimes only saying that a graph entry was detected and listing one source anchor.

The user wants the knowledge base to explain business content: what the business does, what scenario it affects, when a flow triggers, what steps run, what rules and branches exist, how the implementation works, what data is read or written, and what changes are risky. Graph and source evidence should still exist because they protect coverage and traceability, but they should become supporting metadata rather than the main body of the documents.

## Goals

1. Make the official Markdown documents read as business and implementation explanations, not graph or evidence reports.
2. Keep graph-driven coverage. The graph remains the fact source and coverage backbone.
3. Move graph details, node ids, line ranges, edge ids, evidence grades, and source anchors out of normal document bodies and into trace artifacts, coverage reports, quality reports, and indexes.
4. Keep document count from dropping sharply. For the same graph, total Markdown document count should stay at least 90 percent of the current baseline unless the user explicitly asks for a compact mode.
5. Preserve full file/function/class coverage. Every file node still needs a file document, and every function/class node still needs coverage through a file document, flow document, topic document, or index.
6. Preserve entry and required topic coverage. Every entry candidate and required topic must still be explained or explicitly merged into a broader document with a recorded destination.
7. Prevent weak evidence, prompt examples, regexes, tests, and code snippets from becoming official business capability pages unless production or configuration evidence supports them.
8. Add quality checks that reject thin summaries and generic filler even when the headings are present.

## Non-Goals

1. This design does not rewrite `/understand` or the graph scanner.
2. This design does not remove graph, evidence, coverage, or source tracing from the system.
3. This design does not require every function to become a long standalone article.
4. This design does not make business claims that cannot be supported by source, configuration, tests, graph structure, or explicit low-confidence labeling.
5. This design does not remove indexes. Indexes remain useful for engineering navigation and AI retrieval.
6. This design does not hide uncertainty. It moves uncertainty into precise `待确认项`, quality reports, and trace records instead of repeating generic caveats throughout every page.

## Design Summary

The recommended approach is **business narrative documents with traceability on the side**.

The generator should continue to read the graph and source snapshots, but it should first convert them into business narrative material:

- business actors and affected scenarios
- triggering entries
- input objects and important fields
- execution steps
- rules, branches, filtering, ranking, admission, and fallback behavior
- data reads and writes
- configuration and external dependencies
- outputs, side effects, and business impact
- risks and confirmation needs

Writers and deterministic renderers should use this narrative material to produce reader-facing Markdown. The Markdown should answer the business and implementation questions directly. It should not present graph mechanics as the document's subject.

The same generation pass should also produce trace artifacts:

- document-to-node coverage
- node-to-document coverage
- source anchors
- edge coverage
- low-confidence claims
- downgraded or merged document destinations
- baseline document-count comparison

This keeps the documents readable without weakening the coverage model.

## Current Problems To Fix

### Graph Language Leaks Into Official Pages

Current generated pages often say that a graph detected an entry, that a document covers a number of nodes, or that a behavior was not recognized in the graph. These phrases are useful diagnostics, but they distract business readers. The official Markdown should describe the real system behavior, while graph diagnostics should move to trace and reports.

### Evidence Sections Dominate The Reading Experience

Current writer contracts require sections such as `## 代码证据` and `## 测试证据`. Quality validation also checks whether evidence is explained in the Markdown. This encourages writers to optimize for auditability rather than business clarity. Evidence should remain mandatory, but it should be mandatory in `trace`, not in the human-facing body.

### Business Capabilities Can Be Created From Weak Signals

The current `business-facts.ts` and capability renderer can promote code snippets, prompt examples, tests, or regexes into capability documents. This creates pages whose titles look like source code instead of business concepts. Weak signals should be retained as low-confidence claims or pending business signals, not presented as official capabilities.

### Flow Documents Are Too Thin

Some flow pages contain only a conclusion, one execution bullet, a source evidence table, and a generic confirmation warning. A flow document should explain the trigger, participants, steps, rules, data movement, fallback behavior, and risk. If graph context is sparse, the document should still explain the entry's role and record the missing details precisely.

### File Documents Overuse Function Cards

Current file documents can become long lists of function cards that repeat node ids, locations, generic responsibilities, and graph relationships. File documents should instead explain what part of the business or implementation the file owns, how its functions collaborate, and what risks changes introduce. Function/class coverage must remain complete, but coverage does not require every function to be a rigid card.

## New Document Model

### Reader-Facing Markdown

Official Markdown is written for business readers first and engineers second. It should explain behavior using business and implementation language. It should avoid internal generator terms unless the document is explicitly a report or index.

Terms that should be banned or heavily limited in normal body documents:

- `图谱`
- `节点 ID`
- `coveredNodeIds`
- `sourceEvidence`
- `evidenceRole`
- `证据等级`
- `代码证据`
- `测试证据`
- `未在图谱中识别`
- long node id tables
- long line-range tables

Allowed exceptions:

- `覆盖报告.md`
- `质量报告.md`
- `索引/`
- `.trace/` JSON artifacts
- explicitly named debugging or diagnostic documents

### Trace Artifacts

Every official Markdown document should have a corresponding trace record. The trace is the contract that preserves coverage, evidence, and AI retrievability.

Recommended output:

```text
.understand-anything/knowledge-base/
├── 业务流程/
├── 业务能力/
├── 文件文档/
├── 关键实现专题/
├── 索引/
├── 覆盖报告.md
├── 质量报告.md
└── .trace/
    ├── document-traces.json
    ├── coverage-map.json
    └── low-confidence-claims.json
```

The existing `关键函数专题/` path may be kept for compatibility, but titles should say `关键实现专题` where appropriate.

## Narrative Data Model

Add a business narrative layer between project profiling and Markdown rendering.

Suggested module:

- `packages/core/src/knowledge-base/narrative.ts`

Suggested core types:

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
  confidence: "high" | "medium" | "low";
}

export interface BusinessNarrativePlan {
  documentPath: string;
  documentType:
    | "business-flow"
    | "business-capability"
    | "file-implementation"
    | "implementation-topic";
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

The narrative layer should derive content from:

- `entryCandidates` for business-flow plans
- `TopicPlanItem` and topic candidates for implementation-topic plans
- `FileDocTask` for file-implementation plans
- `BusinessCapabilityProfile` for business-capability plans
- call, read, write, configure, import, and contains edges for steps and dependencies
- source snapshots for concrete rule and fallback hints
- evidence classifications for confidence and confirmation needs

## Trace Data Model

Add trace support either in `types.ts` or a new `trace.ts`.

Suggested type:

```ts
export interface DocumentTrace {
  documentPath: string;
  documentType:
    | "business-flow"
    | "business-capability"
    | "file-implementation"
    | "implementation-topic"
    | "index"
    | "report";
  coveredNodeIds: string[];
  coveredFilePaths: string[];
  coveredEdgeIds: string[];
  sourceAnchors: Array<{
    filePath: string;
    lineRange?: [number, number];
    nodeId?: string;
    role: "primary" | "supporting" | "example-only" | "structural";
  }>;
  coverageLevel:
    | "business-flow"
    | "business-capability"
    | "implementation-detail"
    | "index-only"
    | "trace-only"
    | "needs-confirmation";
  lowConfidenceClaims: string[];
  movedInternalDetails: string[];
}
```

The generated knowledge base should also expose:

- `documentTraces`: all document trace records
- `coverageMap`: graph node to document mapping
- `lowConfidenceClaims`: claims from weak or non-production evidence
- `documentMovement`: merged, downgraded, or trace-only destinations

## Coverage Requirements

Coverage must not be sacrificed to improve readability.

Hard requirements:

1. File document count equals file node count.
2. Every file node is covered by a file implementation document.
3. Every function node is covered by a file implementation document, business flow, implementation topic, or index.
4. Every class node is covered by a file implementation document, business flow, implementation topic, or index.
5. Every entry candidate is covered by a business flow or explicitly merged into a broader business flow.
6. Every required topic is covered by an implementation topic or explicitly merged into a broader document.
7. Total Markdown document count is at least 90 percent of the previous baseline for the same graph.
8. Any document that is removed, merged, or downgraded must have a recorded destination in coverage report and trace.
9. Official business capability pages cannot be created from prompt-only or test-only evidence unless production/configuration evidence also supports the capability.

Coverage statuses:

- `business-flow`: explained as part of a business process.
- `business-capability`: explained as a business rule or capability.
- `implementation-detail`: explained in a file implementation document or key implementation topic.
- `index-only`: listed in an index because it is simple or low business impact.
- `trace-only`: retained only as trace/supporting material.
- `needs-confirmation`: has business signals but cannot yet be treated as confirmed behavior.

## Document Templates

### Business Flow Documents

Use for API handlers, jobs, event consumers, CLI commands, lifecycle entries, and cohesive entry-to-result workflows.

Template:

```text
# <流程名>

## 这条流程解决什么问题
## 什么时候会触发
## 参与对象和关键数据
## 完整执行步骤
## 关键规则和分支
## 数据读写与外部依赖
## 兜底和异常处理
## 改动风险
## 待确认项
```

Section expectations:

- `这条流程解决什么问题`: explain the business goal, affected user/system scenario, and final result. Do not merely say it handles a request.
- `什么时候会触发`: describe entry type, upstream caller, request/event/job conditions, and configuration switches when known.
- `参与对象和关键数据`: name business objects such as user, form, candidate set, order, strategy config, database record, cache, endpoint, or external service.
- `完整执行步骤`: use numbered steps. Each step should say what happens, why it happens, what it depends on, what it produces, and what happens if it fails.
- `关键规则和分支`: explain conditions, matching behavior, non-matching behavior, filtering, sorting, admission, fallback, or state transition logic.
- `数据读写与外部依赖`: explain reads, writes, configurations, tables, services, schemas, and side effects.
- `兜底和异常处理`: explain empty data, missing config, failed dependency, default values, skip logic, or error behavior.
- `改动风险`: explain which step changes affect which business result and what regression scenarios matter.
- `待确认项`: include only specific unknowns that need production config, database state, logs, metrics, or business owner confirmation.

Even when a flow has only one entry node, the document must explain what the entry accepts, what it delegates, what it returns, what can fail, and why it matters.

### Business Capability Documents

Use for confirmed business rules, strategies, configuration-backed behaviors, form types, experiments, quotas, recall, filtering, routing, or admission.

Template:

```text
# <能力名>

## 能力说明
## 适用场景
## 触发条件
## 规则明细
## 命中后的处理
## 未命中或异常时的处理
## 依赖的数据和配置
## 和其他能力的关系
## 改动风险
## 待确认项
```

Section expectations:

- `能力说明`: describe the capability in business language. Do not say it is aggregated from facts.
- `适用场景`: explain which users, requests, tasks, pages, operations, or downstream systems are affected.
- `触发条件`: list concrete conditions such as form type, status enum, config switch, strategy key, experiment bucket, or table field.
- `规则明细`: explain each rule with condition, decision, result, and business meaning.
- `命中后的处理`: explain what happens after a match, such as routing, filtering, weighting, returning a result, or writing state.
- `未命中或异常时的处理`: explain default path, fallback value, skip behavior, downgrade, or error behavior.
- `依赖的数据和配置`: name data/config dependencies without exposing node ids or long line tables in the body.
- `和其他能力的关系`: explain whether this capability is upstream/downstream of other strategies or flows.
- `改动风险`: explain possible product effects such as wrong filtering, wrong routing, empty result, ranking shift, or state inconsistency.
- `待确认项`: capture weak evidence and production unknowns.

Prompt-only, tooling-example-only, and test-only signals should not become formal business capability pages. They should become low-confidence claims or pending signals unless production or configuration evidence supports them.

### File Implementation Documents

File documents keep one document per file node, but the body changes from function-card inventory to implementation explanation.

Template:

```text
# <file path> 实现说明

## 文件在系统里的作用
## 它负责的业务步骤
## 主要输入和输出
## 内部协作方式
## 关键函数或类怎么分工
## 规则、兜底和副作用
## 修改这个文件的风险
## 覆盖状态
```

Section expectations:

- `文件在系统里的作用`: explain what the file owns in the product, workflow, generation pipeline, UI, parser, persistence, or supporting infrastructure.
- `它负责的业务步骤`: describe the steps owned by this file. For technical files, describe the technical guarantee and why it matters.
- `主要输入和输出`: explain incoming data, configuration, graph/profile/source snapshots, UI state, generated artifacts, or external input/output.
- `内部协作方式`: explain how functions/classes collaborate inside the file.
- `关键函数或类怎么分工`: cover important functions/classes in prose or compact grouped lists. Every function/class must be represented in coverage, but not every one needs a rigid card.
- `规则、兜底和副作用`: explain validation, normalization, filtering, fallback, writes, cache/state updates, filesystem writes, or generated output.
- `修改这个文件的风险`: explain behavior changes and regression areas.
- `覆盖状态`: keep short. It may say coverage is recorded in trace. It should not print full node id tables.

Simple helpers can be grouped. Do not force business meaning into purely technical helpers; instead explain what implementation guarantee they provide.

### Key Implementation Topic Documents

Use for functions/classes that carry business decisions, complex orchestration, data flow, fallback behavior, or cross-module impact. Existing `关键函数专题/` path can remain for compatibility, but content should be titled and written as implementation topics.

Template:

```text
# <函数/类/实现点> 关键实现专题

## 为什么它关键
## 它处在流程的哪一步
## 输入是什么
## 执行过程
## 关键判断和算法
## 输出和副作用
## 失败、兜底和边界情况
## 上下游影响
## 修改风险
```

Section expectations:

- `为什么它关键`: explain business or implementation impact.
- `它处在流程的哪一步`: place it in the surrounding process without listing raw graph edges.
- `输入是什么`: describe meaningful inputs and dependencies.
- `执行过程`: use ordered steps. A one-sentence summary is not enough.
- `关键判断和算法`: explain conditions, loops, ranking, filtering, grouping, merging, validation, or state transitions.
- `输出和副作用`: explain returned values, generated artifacts, writes, state changes, emitted events, or UI effects.
- `失败、兜底和边界情况`: explain empty/missing/invalid/error cases.
- `上下游影响`: explain what upstream depends on it and what downstream behavior changes if it changes.
- `修改风险`: explain regression risks and tests or scenarios to rerun.

## Writer Contract Changes

Update:

- `packages/core/src/knowledge-base/writer-contracts.ts`
- `agents/kb-file-writer.md`
- `agents/kb-topic-writer.md`

Writer outputs should contain both body and trace:

```json
{
  "batchIndex": 1,
  "documents": [
    {
      "documentPath": "文件文档/src-service-feed.ts.md",
      "title": "src/service/feed.ts 实现说明",
      "markdown": "...business-first markdown...",
      "trace": {
        "documentPath": "文件文档/src-service-feed.ts.md",
        "documentType": "file-implementation",
        "coveredNodeIds": [],
        "coveredFilePaths": [],
        "coveredEdgeIds": [],
        "sourceAnchors": [],
        "coverageLevel": "implementation-detail",
        "lowConfidenceClaims": [],
        "movedInternalDetails": []
      },
      "warnings": []
    }
  ]
}
```

Existing machine fields such as `coveredFunctionNodeIds`, `coveredClassNodeIds`, `coveredNodeIds`, `sourceEvidence`, and `evidence` may remain for compatibility during migration, but body validation should no longer require them to appear inside Markdown.

Prompt rules:

- Write detailed Chinese explanatory prose.
- Do not write graph mechanics in the body.
- Do not include `## 代码证据` or `## 测试证据` in normal body documents.
- Do not expose node ids, edge ids, or long file/line tables in normal body documents.
- Use trace for source anchoring and coverage.
- If behavior is uncertain, state the specific uncertainty in `待确认项`.
- Avoid repeated generic fallback phrases.
- Preserve coverage obligations in trace.

## Deterministic Renderer Changes

Update:

- `packages/core/src/knowledge-base/markdown.ts`

Required renderer changes:

- `renderDeterministicFileWriterDocument`: render a file implementation document instead of a function-card-heavy document.
- `renderDeterministicTopicWriterDocument`: render a key implementation topic instead of a graph/evidence topic.
- `renderFlowDoc`: render full business flow sections instead of conclusion, execution order, code evidence, and generic verification text.
- `renderBusinessCapabilityDocuments`: render business capability explanations for confirmed capabilities and send weak signals to low-confidence reports.
- `renderCoverageReport`: report body coverage, trace coverage, merged/downgraded destinations, baseline count comparison, and fallback status.
- Add `renderQualityReport`.

Fallback output can be lower confidence, but it must still use the new templates. If it cannot infer enough business behavior, it should produce a technical support explanation and mark the document as `draft-from-structure` in quality reporting.

## Business Fact And Capability Changes

Update:

- `packages/core/src/knowledge-base/business-facts.ts`

Changes:

1. Do not promote `prompt-or-tooling-example` facts into formal capability pages by default.
2. Do not promote `test` facts into formal capability pages unless production or configuration evidence supports the same capability.
3. Generate capability titles from business terms, not raw code snippets, regexes, or `if` statements.
4. If the best title is a code snippet, downgrade the item to low-confidence claims.
5. Use the business lexicon for detection and prioritization, not proof.
6. Deduplicate repeated test fixture facts before capability grouping.
7. Record weak or downgraded signals in `low-confidence-claims.json` and the quality report.

## Quality Gates

Update:

- `packages/core/src/knowledge-base/quality.ts`
- `packages/core/src/knowledge-base/writer-contracts.ts`

Body quality checks:

1. Required sections exist for the document type.
2. Core sections contain enough detail. A heading with one generic sentence fails.
3. Step/process sections contain ordered or structured steps.
4. Rule sections contain concrete conditions and results.
5. Normal body documents do not leak banned internal terms.
6. Generic filler phrases are limited and should fail when repeated.
7. `根据代码推断，需线上配置确认` cannot be used as a generic repeated fallback; it must name a specific unknown.
8. Function names, path lists, node ids, or line tables do not count as sufficient prose.
9. File documents must represent every function/class through grouped coverage, implementation steps, or trace.
10. Business capability documents must not be created from weak evidence alone.

Trace quality checks:

1. Every official Markdown document has a trace record.
2. Every trace `coveredNodeId` exists in the graph.
3. Every file document trace covers its file node.
4. Every file document trace covers child function/class nodes or records why they are index-only.
5. Every business flow trace covers its entry candidate or records its merged destination.
6. Every required topic trace covers the topic node or records its merged destination.
7. Low-confidence claims are recorded when behavior is inferred from weak sources.
8. Markdown terms that look like business capabilities have trace support or pending-confirmation status.

Coverage quality checks:

1. Markdown document count is at least 90 percent of baseline.
2. File document count equals file node count.
3. Function/class coverage is 100 percent.
4. Entry flow coverage is 100 percent.
5. Required topic coverage is 100 percent.
6. `index-only` and `trace-only` counts are reported and should not grow unexpectedly without explanation.

## Failure And Retry Behavior

Writer retries should receive precise quality feedback. Avoid generic messages such as `document failed quality validation`.

Example retry reason:

```text
业务流程文档缺少“完整执行步骤”；正文过度使用“图谱/节点/代码证据”等内部词；关键规则章节只有函数名，没有解释触发条件和命中结果。请重写正文，保留 trace 覆盖范围不变。
```

Retry instructions:

- Preserve coverage and trace unless the trace is invalid.
- Rewrite body prose first.
- Add steps with action, dependency, output, and failure behavior.
- Move node ids, line ranges, and evidence grades out of body and into trace.
- Replace generic confirmation text with specific `待确认项`.

If retries still fail, the pipeline may emit a lower-confidence document, but it must be marked in `质量报告.md` and trace. It should not silently pass as high-quality output.

## Reports

### Coverage Report

`覆盖报告.md` should include:

- document count and baseline comparison
- coverage by category
- file/function/class coverage
- entry coverage
- required topic coverage
- formal business capability count
- downgraded or merged document destinations
- index-only, trace-only, and needs-confirmation counts
- fallback document count

### Quality Report

`质量报告.md` should include:

- documents that failed or barely passed body quality
- documents with internal term leakage
- documents generated from deterministic fallback
- weak business signals that were not promoted to formal capabilities
- prompt-only/test-only/tooling-only claims
- documents needing human review

### Trace Files

`.trace/` should include:

- full document traces
- graph node to document mapping
- document to source anchor mapping
- low-confidence claims
- merged/downgraded destinations

## Implementation Areas

Expected code areas:

- `packages/core/src/knowledge-base/types.ts`
- `packages/core/src/knowledge-base/narrative.ts` or equivalent new module
- `packages/core/src/knowledge-base/trace.ts` or equivalent new module
- `packages/core/src/knowledge-base/business-facts.ts`
- `packages/core/src/knowledge-base/writer-contracts.ts`
- `packages/core/src/knowledge-base/quality.ts`
- `packages/core/src/knowledge-base/markdown.ts`
- `packages/core/src/knowledge-base/generate.ts`
- `packages/core/src/knowledge-base/merge.ts`
- `skills/understand-kb/generate-knowledge-base.mjs`
- `skills/understand-kb/SKILL.md`
- `agents/kb-file-writer.md`
- `agents/kb-topic-writer.md`

Avoid unrelated dashboard, graph rendering, UI, or scanner changes in the first implementation pass.

## Testing Plan

Unit tests:

1. Business flow Markdown rejects internal graph/evidence terms in normal body sections.
2. Business flow Markdown requires multiple execution steps.
3. Business capability Markdown requires trigger conditions and rule details.
4. File implementation Markdown can cover functions/classes without rigid function cards.
5. Trace validation fails when required node coverage is missing.
6. Prompt-only facts do not create formal business capability pages.
7. Test-only facts do not create formal business capability pages without production/config support.
8. Capability titles are not regexes, `if` statements, or source snippets.
9. Deterministic fallback uses new templates.
10. Repeated generic phrases fail quality validation.

Integration tests:

1. Generate a small fixture knowledge base and assert file document count equals file node count.
2. Assert function/class coverage remains 100 percent.
3. Assert entry flow coverage remains 100 percent.
4. Assert required topic coverage remains 100 percent.
5. Assert total Markdown document count is at least 90 percent of baseline.
6. Assert official body documents do not contain `## 代码证据`.
7. Assert `.trace/document-traces.json` contains coverage and source anchors.
8. Assert downgraded weak capabilities appear in quality report or low-confidence claims.
9. Assert coverage report lists merged/downgraded destinations.

Manual verification:

1. Run `/understand-kb` on this repository.
2. Inspect representative pages from `业务流程/`, `业务能力/`, `文件文档/`, and `关键实现专题/`.
3. Confirm pages explain business or implementation behavior in detail.
4. Confirm graph/evidence language is absent from normal body documents.
5. Confirm coverage report and trace preserve source and node coverage.
6. Compare document count against the previous generated knowledge base.

## Acceptance Criteria

1. Official Markdown pages read as business or implementation explanations rather than graph/evidence reports.
2. Graph details and source anchors are available in trace/report artifacts.
3. Total Markdown document count is at least 90 percent of baseline for the same graph.
4. File document count equals file node count.
5. Function and class coverage is 100 percent.
6. Entry flow coverage is 100 percent.
7. Required topic coverage is 100 percent.
8. Business flow documents include trigger, participants, execution steps, rules/branches, data movement, fallback, risk, and confirmation sections.
9. Business capability documents include scenario, trigger, rule details, match behavior, non-match behavior, dependencies, relationships, risk, and confirmation sections.
10. Formal business capabilities are not generated from prompt-only or test-only evidence.
11. Capability titles are human-readable business terms, not source snippets.
12. Quality validation rejects thin one-paragraph documents and generic filler.
13. Deterministic fallback follows the new document templates and marks lower confidence when needed.
14. Coverage and quality reports explain any merged, downgraded, index-only, or trace-only items.

## Migration Strategy

Implement in two phases.

Phase 1 changes only the knowledge-base generation layer:

- add narrative and trace models
- update renderer templates
- update writer contracts and prompts
- update quality validation
- update capability grouping
- update reports and tests

Phase 2 can enhance graph scanning if business steps still lack enough source detail:

- stronger database/table recognition
- better endpoint and route extraction
- richer read/write/config dependency detection
- deeper control-flow and fallback extraction

The first implementation pass should stay focused on Phase 1 because it directly addresses the current document quality problem without changing scanner behavior or dashboard UI.

## Review Notes

The central decision is to keep the graph as the source of truth while removing graph language from reader-facing pages. The generated knowledge base should feel like a detailed business and implementation manual. Trace artifacts and reports should carry the evidence burden.

The design intentionally protects coverage and document count. It cleans the content by moving internal material to the right layer, not by deleting documents.
