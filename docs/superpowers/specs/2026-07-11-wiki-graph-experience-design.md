# Wiki-First Knowledge and Graph Experience Design

**Date:** 2026-07-11

**Status:** Approved section-by-section in dialogue; awaiting review of this written specification

**Scope:** Knowledge generation, Wiki information architecture, document-to-graph semantics, graph interaction, legacy UI cleanup, compatibility, and acceptance

## 中文审阅摘要

本设计把产品统一为一套 Wiki-first 入口：主 Wiki 只展示少而精的推荐阅读内容，全量文件、函数和类型保留在可搜索的代码参考层。正文按“项目目的 → 真实流程 → 规则分支 → 模块实现 → 源码证据”逐层深入，同时服务业务读者和工程师。

生成器、Wiki 和图谱共同使用 V2 知识契约，严格区分直接讲解、上下文提及、内容质量、证据健康、生成状态和参考覆盖。主干知识可阅读性与全量代码参考覆盖率分别计算。低质量正文、伪流程、无证据业务结论和源码读取失败后的诊断稿不能进入主 Wiki。

图谱默认采用渐进式架构视图。单击选择，双击或明确按钮下钻；选中后恢复原 `understand-anything` 的流动连线、邻居高亮和无关元素淡化，但颜色适配新主题，并移除末端大箭头。默认节点只使用小型覆盖徽标，聚合节点显示覆盖比例，不再整块标红。

界面只保留知识库、关系图谱、全局搜索、主题和确有数据的上下文操作。旧 Persona、Domain/Structural、Diff、密集筛选、旧 PathFinder、Tour、Onboarding 和伪开关从活跃产品中移除。所有用户可见内容以简体中文为发布要求。

## Summary

`understand-code` will keep one shared entry for business readers, product or operations readers, and engineers. The product will not introduce persona modes or separate business and engineering portals. It will use progressive disclosure instead:

> Project purpose → capabilities → real flows → rules and branches → module implementation → source evidence

The Wiki remains the default surface. The graph remains a peer surface for structural exploration and source verification. A curated main Wiki provides a clear reading route, while an exhaustive reference layer keeps every file and symbol discoverable without flooding the primary navigation.

The central architectural change is a V2 knowledge contract shared by generation, Wiki, search, and graph. It separates direct explanation from contextual mention, content quality from evidence health, and main-Wiki readiness from exhaustive reference coverage. This prevents the current UI from treating ordinary undocumented helpers, failed generation, weak evidence, and real documentation gaps as one red state.

## Current Problems

The repository contains several generations of product design that are individually reasonable but collectively inconsistent:

- The 2026-07-03 workbench design made the graph the primary entry.
- The 2026-07-09 console design made the Wiki the default entry.
- Earlier quality designs emphasized preserving document count and full graph coverage.
- The current user requirement emphasizes useful content, a short reading path, and precise code traceability.

The resulting implementation mixes a Wiki-first shell with graph-first coverage semantics:

- Large repositories produce long Wiki trees with no obvious starting point.
- Related pages and pages that directly explain a node are merged in several UI paths.
- Aggregate graph scopes become gaps when any child node has a gap.
- Default graph scopes cannot be selected, so existing edge animation never activates.
- A temporary preview was previously presented even though it read 0 of 277 source files and generated no file or symbol bodies. Diagnostic output must never pass final preview acceptance again.
- Generated flow and file pages can satisfy shallow structural checks while containing little concrete behavior.
- Several controls inherited from `understand-anything` no longer have valid data or observable effects.

## Goals

1. Give a first-time reader a clear starting point in a large repository.
2. Serve business and engineering readers through one progressively detailed narrative.
3. Keep the curated main Wiki small without sacrificing exhaustive file and symbol discoverability.
4. Make generated pages explain real behavior, decisions, data, failure modes, and implementation evidence.
5. Make Wiki-to-graph and graph-to-Wiki navigation precise and explainable.
6. Restore the useful `understand-anything` selection and flowing-edge interaction in the new visual system.
7. Replace the overloaded gap state with separate documentation, quality, evidence, generation, and reference-coverage dimensions.
8. Remove visible controls and runtime states that no longer have meaningful behavior.
9. Make Simplified Chinese a generation and acceptance contract, not a UI fallback string.

## Non-Goals

- Do not create separate business and engineering modes.
- Do not create a third primary surface in addition to Wiki and Graph.
- Do not restore the dense original `understand-anything` toolbar or dark gold visual theme.
- Do not show the entire low-level graph at once to prove completeness.
- Do not generate one Markdown page per ordinary function or type.
- Do not add an LLM chat surface in this scope.
- Do not rewrite the base code scanner or replace the existing knowledge-graph schema.
- Do not restore path finding until real directed call data can support it.
- Do not silently publish deterministic diagnostic output as finished knowledge.

## Success Criteria

- A first-time reader can find the recommended entry and understand one real flow within three minutes.
- A reader can reach a verifiable source location from a core document or graph node in at most two deliberate actions.
- The primary navigation does not grow linearly with file and symbol count.
- Every valid source file and every function or type remains searchable through the reference layer.
- A graph selection visibly updates the node, its one-hop neighborhood, connected edges, and the details rail without relayout.
- Main-Wiki readiness and exhaustive reference coverage are reported separately.
- All user-facing prose, labels, states, and errors are Simplified Chinese except code identifiers, paths, API names, and explicitly whitelisted technical terms.

## Product Structure

### Global Shell

The global shell exposes only:

- Knowledge Base
- Relationship Graph
- Global Search
- Theme

Wiki is the default surface. Graph is a peer surface, not a small decorative panel and not the only navigation model.

No global persona selector, domain-versus-structural switch, diff toggle, old node-type pills, tour, legacy onboarding, or legacy info/files sidebar remains visible.

### Guided Wiki Home

The Wiki home is a guide, not a generation dashboard. It shows:

- A concise explanation of the project.
- A recommended reading route.
- Four progressive stages: project purpose, flows and rules, implementation, and source evidence.
- Real shortcuts to the graph, file or symbol lookup, and configuration or external dependencies.

Coverage percentages, gap counts, generation failures, and maintenance statistics belong to Knowledge Base Status, not the normal reading home.

### Information Architecture

The Wiki has three navigation groups:

1. **Main Reading**
   - Project overview
   - Core capabilities
   - Real business or runtime flows
   - Core modules
   - Key implementation topics
   - Usually 15–40 featured documents, adjusted for repository size and project type

2. **Code Reference**
   - Module → directory → file hierarchy
   - One file document for each valid source file
   - Searchable anchors for every function and type in its owning file document
   - Standalone topics only for important functions, types, rules, orchestration, or risk

3. **Knowledge Base Status**
   - Main-Wiki readiness
   - Reference coverage
   - Content quality failures
   - Evidence and source-read failures
   - Pending dedicated bodies
   - Generation and retry information

Only Main Reading is expanded by default. Reference and Status remain available but do not compete with the reading route.

### Progressive Document Structure

Core pages present information in this order:

1. Purpose and affected scenario
2. Trigger and exclusion conditions
3. End-to-end execution flow
4. Rules, branches, algorithms, and state changes
5. Inputs, outputs, and important fields
6. Module and file collaboration
7. Configuration and external dependencies
8. Failure, fallback, observability, and tests
9. Change risk
10. Source evidence

Business readers can stop after the behavior and rules sections. Engineers continue within the same page into implementation and evidence.

Source links appear next to important claims. Full snippets, line ranges, calls, and test evidence remain collapsed in the right rail until requested.

## V2 Knowledge Contract

### Document Roles and Statuses

```ts
type WikiDocumentRole = "featured" | "reference" | "maintenance";

type WikiDocumentCategory =
  | "overview"
  | "capability"
  | "flow"
  | "module"
  | "topic"
  | "file"
  | "quality"
  | "coverage"
  | "other";

type DocumentationRelation = "direct" | "context" | "none";
type ContentQuality = "verified" | "generated" | "needs-review" | "failed";
type EvidenceHealth = "source-linked" | "weak" | "unreadable" | "missing";
type GenerationStatus = "complete" | "partial" | "failed";
type ReferenceCoverage = "anchored" | "unanchored" | "not-applicable";
type MainReadiness = "ready" | "degraded" | "blocked";
```

These dimensions must remain independent. A node may, for example, have a generated direct body, valid source evidence, and complete reference coverage without being human-verified.

The content-quality values have exact meanings:

- `verified`: explicitly reviewed by a human or an external verification process recorded in the trace.
- `generated`: passed the semantic hard gates and has valid direct evidence, but has not received explicit human or external verification.
- `needs-review`: contains a usable draft or unresolved claim that cannot count toward Main Readiness.
- `failed`: did not pass the publication contract and is available only through Status and retry records.

`quality: "verified"` requires an explicit verification record. A route record is valid only for `role: "featured"`; reference and maintenance pages cannot appear in the guided route.

### Page and Node Link Records

```ts
interface WikiPageV2 {
  id: string;
  title: string;
  summary: string;
  markdownPath: string;
  role: WikiDocumentRole;
  category: WikiDocumentCategory;
  quality: ContentQuality;
  generationStatus: GenerationStatus;
  directNodeIds: string[];
  contextNodeIds: string[];
  evidenceIds: string[];
  searchTerms: string[];
  verification?: {
    method: "human" | "external";
    verifiedAt: string;
    verifier?: string;
  };
  route?: {
    order: number;
    stage: "purpose" | "flow" | "rule" | "implementation" | "evidence";
  };
}

interface WikiNodeDocumentationV2 {
  nodeId: string;
  relation: DocumentationRelation;
  quality: ContentQuality;
  evidenceHealth: EvidenceHealth;
  generationStatus: GenerationStatus;
  referenceCoverage: ReferenceCoverage;
  directPageIds: string[];
  contextPageIds: string[];
  evidenceIds: string[];
  primaryPageId?: string;
  anchor?: string;
}

interface WikiEvidenceV2 {
  id: string;
  nodeIds: string[];
  filePath: string;
  lineRange: [number, number];
  excerpt?: string;
  evidenceType: "production" | "configuration" | "test" | "documentation";
}
```

The exact artifact layout is:

- `.understand-code/knowledge-base/wiki-index.json`: V2 page, node-link, readiness, and coverage metadata.
- `.understand-code/knowledge-base/search-index.json`: full-text, path, business-term, and symbol-anchor records.
- `.understand-code/knowledge-base/.trace/document-traces.json`: exact page, node, claim, and evidence relationships.
- `.understand-code/knowledge-base/.trace/generation-report.json`: source-read, writer, quality, retry, and generation status.

`wiki-index.json` uses `version: 2`. The Dashboard loads the smaller Wiki index first and fetches search or trace artifacts only when their features need them.

### Direct Explanation Versus Context

- `directNodeIds` means the page contains a dedicated substantive explanation of the node.
- `contextNodeIds` means the node is relevant to the page but is not explained in its own substantive section.
- Context never counts as direct coverage.
- A direct page counts as usable direct coverage only when its quality is `verified` or `generated`, its generation status is `complete`, and required evidence is source-linked.
- `needs-review` and `failed` pages retain traceability but do not satisfy Main Readiness or usable direct coverage.
- Search and details show Direct Explanation and Related Material separately.
- Wiki-to-graph focus uses direct nodes by default. Context nodes are an explicit expansion.
- Evidence is shown for a node only when the evidence record explicitly contains that node ID.

### Primary Page Priority

For a node, the primary destination is selected in this order:

1. Direct key topic
2. Direct file document and symbol anchor
3. Direct real-flow document
4. Direct module document
5. Other direct document
6. Context-only material

If no direct page exists, the UI says “暂无专门正文” before listing related material.

### Aggregate Coverage

Aggregate scopes use counts and ratios, never a one-child veto. A module may display:

> 8/10 key objects have a dedicated body; 1 has context only; 1 needs a body.

Node color describes semantic type. A small badge describes documentation status. The default graph does not turn an aggregate scope red because a helper lacks a dedicated article.

### Two Completion States

The index exposes separate summaries:

- **Main Readiness:** whether applicable overviews, routes, flows, modules, and key topics pass quality gates.
- **Reference Coverage:** whether every valid file and every function or type anchor is present and mapped.

Main Readiness can be ready while Reference Coverage is still partial. The reverse does not make the main Wiki ready.

Main Readiness is computed as follows:

- `ready`: source reads are valid, the project overview passes, every page in the published guided route is `verified` or `generated` with complete generation, and every required route stage for the detected project type is represented.
- `degraded`: the published route remains complete and readable, but optional featured candidates, secondary capabilities, or non-route topics failed and were moved to Status.
- `blocked`: source reads are invalid, the overview fails, a required route stage is missing, or a published route page fails its contract.

Reference Coverage reports exact totals for valid files, function anchors, and type anchors. It is complete only when every applicable item is anchored and mapped; otherwise it is partial with explicit missing counts.

## Generation Design

### Pipeline

```text
Knowledge graph + real source tree
  → source snapshots and structural facts
  → business and implementation narratives
  → featured/reference document plan
  → writer generation
  → semantic quality gates
  → Markdown + V2 wiki index + search index + trace records
```

The source root and output root are separate explicit inputs. A graph-only temporary directory cannot masquerade as the source repository.

### Featured Document Planning

Featured content is adaptive rather than quota-driven. Typical output includes:

- One project overview.
- A small set of supported capabilities.
- Approximately 5–12 real flows when the project contains that many valid flows.
- Core module documents.
- Approximately 10–30 key rule or implementation topics for a large application repository.

Libraries, CLIs, infrastructure repositories, and documentation repositories use project-type-appropriate runtime or usage flows. Counts are guidance, not a reason to manufacture pages.

### Reference Planning

- Every valid source file receives a file document.
- Every function and type appears as a stable, searchable anchor within its owning file document.
- Ordinary helpers do not receive standalone pages.
- Key functions or types receive standalone topics when they carry business decisions, complex orchestration, state transitions, external effects, or material change risk.
- Configuration, test, schema, and documentation files use specialized templates.

### Hard Quality Gates

Quality gates validate concrete facts, not only headings or character count.

| Document type | Required substance |
|---|---|
| Project overview | Project purpose, boundaries, lifecycle, main modules, entries, configuration/dependencies, tests, reading route, and at least six valid source anchors |
| Flow | Real trigger, exclusion conditions, at least three causal stages, normal and exceptional branches, data changes, fallback, observability, and at least five valid source anchors. When graph calls are absent, source-level control flow may establish the stages only if distinct anchors prove trigger, decision, and resulting action. |
| Module | Responsibility and non-responsibility, entries, outputs, core files, dependencies, principal flows, state/configuration/test boundary, risks, and at least five valid source anchors |
| File | Why the file exists, exports, actual execution order, inputs/outputs/branches/side effects, configuration/tests, and an anchor for every function and type |
| Key topic | Why it matters, full predicates and skips, data/state changes, branches/errors/degradation, algorithms or decisions, dependencies/tests/observability, and at least three evidence groups with distinct source ranges |

Anchor counts are necessary but not sufficient. Generic filler with many anchors still fails.

The following cannot enter Main Reading:

- Single-node, zero-behavior pseudo-flows.
- Repeated generic prose such as “承担核心逻辑”.
- Business conclusions unsupported by production or configuration evidence.
- Capabilities inferred only from tests, prompt examples, regex samples, or fixtures.
- Diagnostic shells produced after source-read failure.
- Pages that fail Simplified Chinese validation.
- Pages with invalid direct-node or evidence mappings.

Failed pages do not count as direct coverage. They appear in Status and the retry queue.

### Deterministic Output

Deterministic renderers remain useful for planning, indexes, diagnostics, and recovery. They do not silently replace a failed high-quality body. Diagnostic previews are labeled and cannot satisfy final acceptance.

### Route Overrides

The existing `.understand-code/config.json` gains an optional `knowledgeBase` section:

```json
{
  "outputLanguage": "zh-CN",
  "knowledgeBase": {
    "businessTerms": ["示例业务词"],
    "entryNodeIds": ["function:src/example.ts:handle"],
    "route": {
      "pin": ["page:project-overview"],
      "hide": ["page:internal-diagnostic"],
      "order": ["page:project-overview", "page:primary-flow"]
    }
  }
}
```

All fields are optional. Zero-configuration generation remains the default. Invalid override IDs produce a Status warning and do not abort unrelated generation.

Page and node IDs used by overrides are stable across regeneration for the same logical source entity. `pin` promotes an existing page into Main Reading, `hide` removes a page from Main Reading without deleting it from search or reference coverage, and `order` defines the leading route order before automatically ranked pages. Conflicting entries resolve as `hide` first, then `pin`, then `order`, and the Status report records the conflict.

### Simplified Chinese Contract

- `outputLanguage` defaults to `zh-CN` for this product.
- User-visible titles, summaries, sections, states, empty states, and errors must be Simplified Chinese.
- Code blocks, identifiers, paths, API names, protocol names, and whitelisted technical terms may remain in their source language.
- “摘要尚待中文化” is an error state, not acceptable published content.

## Wiki Experience

### Navigation

- Main Reading is the only group expanded by default.
- Code Reference browses module → directory → file and uses lazy expansion or virtualization.
- Functions and types appear only after opening a file or through search.
- Status is collapsed by default and never dominates the reading home.

### Global Search

Search indexes:

- Titles and summaries
- Full prose
- Business terms and aliases
- Module and directory names
- File paths
- Function and type names
- Stable anchors

Results are grouped and ranked:

1. Best direct explanation
2. Capabilities and flows
3. Modules and files
4. Function and type anchors
5. Context-only material

A symbol result opens the owning file page at the stable symbol anchor. Results are paged or virtualized for large repositories while category counts remain visible.

### Page Layout

Desktop keeps three regions:

- Left: short navigation
- Center: progressive Markdown body
- Right: page outline, graph link, related documents, and collapsed evidence

On narrow screens, navigation and evidence become drawers while the article remains primary.

### Evidence Interaction

- Important claims contain concise source links.
- The right rail initially shows file and line summaries.
- Expanding an item reveals excerpt, relationship, test support, and navigation actions.
- Product readers are not forced to read trace metadata.
- Engineers can verify a claim without leaving the page context.

## Visual Direction

The visual reference is the restrained Codex/OpenAI documentation experience shown by the user, applied to a code-intelligence product rather than copied as a website shell.

- Use a calm neutral canvas, high-contrast text, thin dividers, subtle borders, and one restrained accent family.
- Prefer typography, spacing, and hierarchy over decorative cards, gradients, or large colored surfaces.
- Keep the article column readable and stable; metadata never competes with the main prose.
- Use cards primarily on the guided home and for compact summaries. Normal articles remain document-like rather than dashboard-like.
- Keep left navigation compact and right-page context visually secondary.
- Use the same theme tokens in Wiki and Graph so switching surfaces feels continuous.
- Semantic node colors identify responsibilities; documentation state remains a badge or fine border treatment.
- Light mode is the primary visual acceptance reference because it matches the chosen documentation style. Supported dark themes must preserve the same hierarchy and contrast.
- Do not reuse the original dark gold `understand-anything` skin, dense toolbar, rainbow type palette, or large terminal arrowheads.

## Graph Experience

### Progressive Levels

1. **Architecture:** capabilities, flows, core modules, and cross-module relationships.
2. **Module/File:** files and meaningful cross-file relationships within a selected scope.
3. **Symbol/Call:** important functions and types with real call or dependency relationships.

All graph objects remain reachable through drill-down and quick search. Completeness means reachable, not simultaneously visible.

### Selection Model

- Single click selects any raw node, aggregate scope, or boundary portal.
- Single click never drills down.
- Double click or an explicit Enter action drills down.
- Clicking the empty canvas clears selection.
- Breadcrumb navigation returns to parent scope.
- Quick Jump searches modules, files, and symbols.
- Selecting an item updates the details rail and does not recompute the layout.
- The selected item and one-hop neighborhood are pinned above node-count caps.

### Edge Style

Reuse the interaction language of the original `understand-anything` graph while adapting colors to the new document theme:

- Base connected edges use a restrained theme color and approximately 1.5 px width.
- Edges incident to the selected item use approximately 2.5 px width and continuous directional flow.
- Unrelated edges fade to approximately 8% opacity and unrelated nodes to approximately 15–25% visibility.
- Layout remains stable while selection styling changes.
- Large terminal arrowheads are removed. Direction is expressed by motion.
- With reduced-motion preferences, motion stops and a small inline direction mark appears near the middle of the edge. No terminal arrowhead is restored.

### Relationship Truthfulness

- Show Call Relationships only when real `calls` edges exist.
- Show File Dependencies when the source is `imports`.
- Show Structural Dependencies when only structural edges exist.
- Hide a mode when it adds no information beyond the current architecture view.
- Never label fallback imports or containment as calls.

### Coverage Presentation

- Default cards use semantic colors.
- Small badges show dedicated body, context only, needs body, or generation/evidence problem.
- Coverage mode expands exact counts and filters.
- Aggregate scopes display ratios rather than red veto states.
- Complexity is not presented as documentation severity.

### Details Rail

Every raw node, scope, and boundary can show:

- Responsibility and non-responsibility
- Entry and output
- Representative flows
- Upstream and downstream relationships
- Direct explanations
- Context-only material
- Exact source evidence
- Drill-down and Wiki actions

## System Boundaries

The design separates five units:

1. **Knowledge Contract:** V2 types, validation, indexing, completion summaries, and V1 adaptation.
2. **Generation:** source reads, narratives, planning, writers, quality gates, and artifacts.
3. **Search and Navigation:** generated search records, route ordering, and stable anchors.
4. **Wiki Presentation:** home, navigation, Markdown, search, evidence rail, and Status.
5. **Graph Presentation:** semantic hierarchy, layout, selection, edge presentation, coverage badges, and details.

Wiki components do not infer documentation truth from Markdown. Graph components do not merge direct and contextual pages. Compatibility logic remains inside the V1 adapter rather than spreading across UI components.

## Data Flow

```text
Repository scan
  → knowledge graph + source inventory
  → source snapshots and narrative facts
  → featured/reference plans
  → generated Markdown and evidence
  → semantic quality validation
  → V2 wiki index + search index + trace/status artifacts
  → Dashboard validation and loading
  → shared Wiki/Graph selection state
```

Shared runtime state is limited to:

- Current Wiki page
- Current graph scope and level
- Selected graph object
- Direct nodes carried from the current Wiki page
- Search or navigation target

Wiki-to-graph sends direct nodes by default. Graph-to-Wiki opens the primary direct page or explains that only context exists.

## Error Handling and Degradation

### Generation

- Zero source reads, missing required overview, or no valid applicable core route blocks Main Readiness.
- Missing reference pages reduce Reference Coverage without falsely blocking otherwise valid featured content.
- Failed pages remain visible only in Status and retry records.
- Preview metadata includes source-root identity, graph digest, commit hash when available, generation mode, and source-read coverage.

### Dashboard Loading

- Graph without Wiki: Graph remains usable; Wiki provides a clear generation action or instruction.
- Wiki without link data: Markdown remains readable; graph actions explain that linkage is unavailable.
- Invalid evidence: Page remains readable, evidence becomes needs-review, and verified coverage decreases.
- Missing search index: Fall back to title, path, and symbol lookup with a visible degraded-state notice.
- Invalid V2 payload: Reject it safely and try the V1 adapter only when a valid V1 shape exists.

All user-facing errors explain what failed, the effect, and the recovery path in Simplified Chinese. Internal stacks remain in diagnostic logs.

## V1 Compatibility and Migration

- V1 `explainedNodeIds` maps to V2 direct relations.
- V1 `relatedNodeIds` maps to V2 context relations.
- V1 gaps without enough semantics remain unknown or needs-review; they are not upgraded to dedicated-body gaps.
- V1 evidence is shown for a node only when its `nodeIds` explicitly include that node.
- V1 remains read-only. New generation writes V2 only.
- The adapter exposes the same runtime V2 model to Wiki and Graph so components do not branch on versions.

## Legacy UI Cleanup

Retain only controls with real data and an observable result.

### Keep

- Wiki and Graph navigation
- Global search
- Theme
- Architecture, real calls or file dependencies, and document coverage when those modes contain distinct data
- Searchable Quick Jump
- Explicit Exit Current Wiki Focus action

### Remove From the Active Product

- Persona selector
- Domain/Structural switch
- Diff toggle and diff-only state
- File/Class/Function level switch
- Old node-type pills and layer legend
- Legacy filter panel
- Old export flow tied to unmounted React Flow state
- Old undirected path finder
- Keyboard-help surface tied to removed controls
- Tour and legacy onboarding
- Old info/files sidebar
- One-way controls presented as toggles

Theme remains because it has real behavior. Source files for legacy components are deleted only after reference checks prove they have no remaining consumer.

## Large-Repository Protection

- Featured navigation is capped by relevance and route quality, not source count.
- Reference trees use lazy expansion and virtualization.
- Search returns grouped batches and visible category counts.
- Graph scope levels cap ordinary nodes but pin selection and one-hop context.
- Supported browsers use the existing layout worker. Environments without worker support use the same deterministic synchronous layout and show a temporary layout-progress state; they do not change graph semantics.
- Selection changes alter styling only.
- Full coverage remains reachable through search and drill-down.

## Testing Strategy

### Contract Tests

- Direct and context relations remain separate.
- Evidence must explicitly include the current node.
- Primary-page priority is deterministic.
- Main Readiness and Reference Coverage are independent.
- Aggregate counts cannot collapse into a one-child gap veto.
- V1 unknowns do not become false direct coverage or false dedicated-body gaps.

### Generation Tests

- Each document type satisfies its semantic contract.
- Pseudo-flows are rejected from Main Reading.
- Generic and corpus-wide repeated prose fails quality validation.
- Unsupported business claims fail or become needs-review.
- Quality-failed pages do not count as direct coverage.
- Source-read failure cannot produce a successful final preview.
- Route pin, hide, order, entry-node, and business-term overrides work deterministically.
- Simplified Chinese validation excludes code and identifier regions but rejects English placeholder prose.

### Wiki Tests

- Main navigation remains bounded on a large fixture.
- Reference browsing reaches every file.
- Chinese term, path, function, and type queries produce appropriate grouped results.
- Symbol results open the correct stable anchor.
- Inline evidence and the right rail resolve only exact evidence.
- Status metrics do not dominate the reading home.
- Core document to source navigation takes no more than two deliberate actions.

### Graph Tests

- Raw nodes, scopes, and boundaries are selectable.
- Single click selects; double click or Enter drills down; pane click clears.
- Connected edges animate, unrelated elements fade, and no terminal arrowhead appears.
- Reduced-motion direction remains visible through an inline marker.
- Selection does not trigger layout recomputation.
- Selected and one-hop nodes survive graph caps.
- Wiki focus begins with direct nodes only.
- Relationship modes use truthful labels and disappear when redundant.
- Aggregate coverage displays counts and ratios.

### Visual and Accessibility Tests

- Desktop, narrow, and mobile layouts.
- Keyboard focus and selection equivalents.
- Contrast in supported themes.
- Reduced-motion behavior.
- Long Chinese titles, paths, and code identifiers.
- No overlapping labels or dense inherited toolbar.
- No full-card red coverage treatment.

### Real-Repository Acceptance

At least one large real repository is required for final acceptance. Small fixtures alone are insufficient. Acceptance verifies:

- Featured pages contain concrete behavior and evidence.
- Every valid file and symbol remains discoverable.
- Wiki and Graph reverse navigation is accurate.
- The graph remains readable at real scale.
- Source-read coverage and generation mode are visible and valid.
- No old control appears without meaningful behavior.

## Dependency Order

This is one umbrella product specification because the contract, generator, Wiki, and graph semantics are mutually dependent. The implementation plan must split delivery into independently testable milestones while preserving the following dependency order:

1. V2 contract, validation, and V1 adapter
2. Generation semantics, quality gates, and artifacts
3. Search and navigation indexes
4. Wiki home, reference browsing, Status, and evidence interaction
5. Hierarchical graph semantics and restored edge interaction
6. Legacy state and UI cleanup
7. Large-repository, visual, accessibility, and migration verification

This order prevents the frontend from inventing another temporary interpretation of ambiguous V1 data.

## Implementation Constraints

- Preserve all existing user and agent work in the dirty worktree.
- Do not overwrite or include unrelated `docs/review/` content in implementation commits.
- Reuse existing Wiki-first and graph components where their responsibility remains valid.
- Reuse the original `understand-anything` selection and edge interaction logic, not its full toolbench or color theme.
- Do not add a third product surface while migrating.

## Resolved Decisions

- One shared entry serves business and engineering readers.
- Narrative order is business-to-code.
- The home uses a guided reading route.
- The knowledge base has a curated main layer and an exhaustive reference layer.
- Ordinary symbols live as anchors in file documents.
- Main content uses hard quality gates.
- The graph defaults to progressive architecture.
- Edge interaction follows `understand-anything`, uses the new palette, and has no terminal arrowheads.
- Coverage uses small badges and ratio summaries.
- Main readiness and reference coverage are separate.
- Reading routes are automatic with optional configuration overrides.
- Visible controls are minimal and contextual.
- Source evidence is inline and in a collapsible right rail.

No unresolved product decision remains in this specification.
