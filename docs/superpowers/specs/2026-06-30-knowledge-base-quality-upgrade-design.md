# Knowledge Base Quality Upgrade Design

Status: Ready for user review
Date: 2026-06-30

## Background

The current `/understand-kb` pipeline can already generate a large number of Markdown documents from a graph and source files, and the recent writer-pool work reduced the memory risk from launching too much work at once. The remaining problem is quality: many generated pages are too generic, too technical, or too thin for business readers.

The desired knowledge base should not merely say that a file "handles core logic". It should explain what business problem the code solves, which roles or scenarios are affected, what conditions trigger the logic, what the inputs and outputs are, what fallbacks exist, and what risks a future change may introduce. It should also preserve important business terms from code, such as `注册表单`, `表单校验`, and `默认选项`, while making clear whether the evidence comes from production logic, configuration, comments, tests, or tooling examples.

## Goals

1. Do not reduce document coverage. The next version must keep at least the current number of planned documents for file docs, function cards, class cards, topic docs, and business capability docs. It may add more.
2. Make every generated document more detailed and more useful to non-technical readers.
3. Preserve real business concepts from code. Business terms must not be filtered merely because they look domain-specific or unfamiliar.
4. Separate business meaning from evidence strength. A term found in production strategy logic should be treated differently from the same term found only in a test, prompt, extractor regex, or example fixture.
5. Keep the process memory-safe. The writer pool remains bounded, default parallelism stays conservative, source loading stays capped, and the generator remains resumable.
6. Avoid day-level runtimes. Quality may be slower than the deterministic fallback, but the design must use compact context packets and bounded retries so a large repository can finish in hours rather than days.

## Non-Goals

1. This upgrade will not try to prove facts outside the repository. It will explain what the code says, and label assumptions or unknowns.
2. This upgrade will not blacklist terms like `注册表单`, `表单校验`, or `默认选项`.
3. This upgrade will not replace the graph builder or dashboard UI.
4. This upgrade will not launch unbounded subagents. Higher quality comes from better evidence packets, prompts, and validation, not from fan-out.
5. This upgrade will not remove deterministic generation. Deterministic output remains useful as a coverage fallback and diagnostic baseline, but it should not be presented as the high-quality final answer when a writer doc is available.

## Design Summary

The upgrade adds a quality layer between raw code facts and final Markdown. The generator will first classify evidence by source and confidence, then build compact context packets for each document, then ask bounded writer workers to produce reader-friendly docs, and finally validate the result with stronger semantic quality checks.

The important shift is this: the pipeline should not ask "did this term appear?" and immediately turn it into a capability. It should ask "where did this term appear, what code behavior surrounds it, and how confidently can we explain it to a business reader?"

## Evidence Model

Each extracted business fact becomes a `BusinessEvidence` record instead of a flat keyword hit.

Fields:

- `term`: the business term or phrase.
- `sourceKind`: one of `production-logic`, `configuration`, `comment`, `test`, `documentation`, `prompt-or-tooling-example`, or `graph-structure`.
- `evidenceRole`: one of `primary`, `supporting`, or `example-only`.
- `confidence`: one of `high`, `medium`, or `low`.
- `path`: the source file.
- `symbol`: the closest function, class, constant, or module when available.
- `lineRange`: the source line range when available.
- `snippet`: a short source excerpt.
- `businessMeaning`: a plain-language explanation of what the evidence appears to represent.
- `riskFlags`: warnings such as `test-only`, `prompt-only`, `regex-only`, `comment-only`, or `source-cap-truncated`.

Source classification is based on file path, AST node kind, surrounding code, and repository profile. It is not based on whether a term sounds unusual. For example:

- `注册表单` in a production branch, strategy function, config constant, or enum can be primary evidence.
- `注册表单` in a test case can be supporting evidence.
- `注册表单` only inside a writer prompt, extractor regex, or example fixture is example-only evidence.

This means the generator keeps valuable business language, but stops pretending that prompt examples are production behavior.

## Business Lexicon

The pipeline will support a small business lexicon that boosts known domain terms without making unsupported claims. The default seed can include terms such as `表单`, `注册表单`, `表单校验`, `默认选项`, `策略`, `配额`, `导流`, `过滤`, `准入`, and `实验`.

The lexicon affects prioritization and explanation depth, not truth. A lexicon hit still needs evidence. If the only evidence is from tests or examples, the document must say that clearly.

The lexicon should be configurable per repository so a business repo can preserve its own vocabulary without hardcoding every domain term into the tool.

## Document Coverage

The planner must keep all existing document categories:

- project overview
- business capability index
- business capability documents
- topic documents
- file documents
- function cards
- class cards
- coverage and quality reports

Low-evidence or low-confidence areas should still produce documents. They should be labeled honestly rather than skipped. For example, a page may say "this file has limited direct business evidence, but it participates in configuration loading and affects these downstream behaviors."

## Detailed Document Contract

Every generated document should use a business-reader-first structure. The exact headings can vary by document type, but each page must cover the following questions. When evidence is weak or unavailable, the page must say exactly what is missing, why the document still exists, and what can safely be concluded from the code that was found.

1. What business problem does this code or capability solve?
2. Who or what scenario is affected?
3. What are the key rules, trigger conditions, or decision branches?
4. What inputs, outputs, state changes, or side effects matter?
5. What fallback, exception, boundary, or failure behavior exists?
6. What upstream and downstream modules depend on this behavior?
7. What would be risky to change?
8. Which code evidence supports the explanation?
9. What is the shortest plain-language summary for non-technical readers?

File documents should explain the file's business purpose, important exported functions/classes, key data it reads or writes, and how it fits into the larger flow.

Function cards should explain the function's role, inputs, outputs, decision points, side effects, and business impact. If a function is purely technical, the card should say what technical guarantee it provides and why that matters to the product or knowledge-base pipeline.

Class cards should explain the responsibility of the class, its lifecycle, key methods, state it owns, and how callers use it.

Business capability documents should explain the capability in non-technical language, list the concrete strategy rules found in code, show the evidence grade for each rule, and separate confirmed behavior from inferred behavior.

Topic documents should tie related files together into a coherent workflow instead of listing files one by one.

## Writer Context Packets

The writer should receive a compact, source-backed packet for each document:

- document type and intended reader
- target file, function, class, topic, or capability
- evidence records with source kind, confidence, and snippets
- related graph nodes and neighbors
- caller/callee or dependency context when available
- relevant file summaries from previous docs
- business lexicon hits
- known unknowns and source truncation warnings

Context packets should be capped by size and ranked by relevance. This keeps quality high without passing the whole repository to every writer.

## Quality Gates

Validation must move beyond checking whether headings exist. A generated document should fail validation when it is structurally complete but semantically empty.

Required checks:

1. Required sections are present for the document type.
2. Sections contain meaningful detail, not only generic phrases or one-sentence filler.
3. Claims about business behavior cite at least one code evidence item.
4. The document does not overuse vague wording such as "承担核心逻辑", "处理相关能力", "根据代码推断，需线上配置确认", or "未在图谱中识别".
5. Important functions, classes, or business terms from the task packet are explained, not merely named.
6. Low-confidence claims are labeled as low-confidence or inferred.
7. Business capability docs show evidence grade and source files for each major rule.
8. A capability cannot be promoted from example-only evidence alone.
9. A deterministic fallback document is marked as draft or lower quality unless it passes the same semantic checks.

When validation fails, the writer should retry with the exact validation issues. Retry count remains bounded to protect runtime.

## Capability Grouping

Business capability grouping should become evidence-first:

- Primary capability: has production logic or configuration evidence.
- Supported capability: has multiple supporting signals, such as comments plus tests plus related graph structure.
- Example-only capability: appears only in docs, prompts, examples, extractor code, or fixtures.

The business capability index should show these categories explicitly. This avoids losing important terms while also avoiding false confidence.

## Runtime And Memory Controls

The existing protections stay in place:

- default writer parallelism remains conservative
- large repositories should run with `--parallel 1` or `--parallel 2`
- source loading remains bounded by `--max-source-mb`
- phased generation remains resumable
- deterministic large-run escape hatches remain explicit

The quality upgrade adds bounded retries and compact context packets. It should not add unbounded subagent dispatch or whole-repository prompts.

The command output should show progress, writer retry counts, quality failures, and an estimated remaining workload so users can tell whether a run is healthy before it becomes too expensive.

## Error Handling

If the writer cannot produce a passing document after bounded retries, the pipeline should still write a document, but it must mark the page as lower confidence and explain what evidence was insufficient.

If source content is truncated by `--max-source-mb`, affected documents must include a source-truncation warning in the evidence section.

If evidence classification cannot determine whether a path is production, test, documentation, or tooling, the classifier should default to `supporting` rather than `primary`.

If the graph has missing relationships, such as missing call edges, documents should avoid claiming exact call chains and should state that relationship evidence is incomplete.

## Testing Plan

Unit tests:

- classify production strategy code as primary evidence
- classify config constants and enums as primary or supporting evidence
- classify comments as supporting evidence
- classify tests as supporting evidence
- classify prompts, extractor regexes, and example fixtures as example-only evidence
- keep terms like `注册表单`, `表单校验`, and `默认选项` when they appear in source evidence
- prevent example-only evidence from becoming a primary business capability
- reject generic documents that only satisfy heading checks
- accept detailed documents with source-backed claims

Integration tests:

- generate a small fixture knowledge base and assert document count is not reduced
- verify business capability index shows evidence categories
- verify a file doc includes business purpose, affected scenario, key rules, inputs/outputs, fallbacks, risks, and code evidence
- verify deterministic fallback output is labeled when it does not pass high-quality checks

Manual verification:

- run the upgraded pipeline on the current repository with bounded writer parallelism
- inspect representative file docs, function cards, and business capability docs
- compare document count against the previous run
- confirm memory usage remains stable during a larger run

## Acceptance Criteria

1. Generated document count is greater than or equal to the current baseline for the same graph and repository.
2. Every document type has a detailed business-reader structure.
3. Important business terms are preserved and explained when evidence exists.
4. Business capabilities cannot be created solely from prompt, regex, fixture, or tooling-example evidence.
5. Business capability docs show source evidence and confidence for major rules.
6. File docs and function cards explain concrete behavior rather than repeating generic summaries.
7. Validation rejects thin documents that merely contain the right headings.
8. The writer pool remains bounded and does not fan out into too many subagents.
9. Large-repository runs remain resumable and bounded by source-size and parallelism settings.
10. The final coverage report includes both coverage status and quality status.

## Implementation Boundaries

Expected implementation areas:

- `packages/core/src/knowledge-base/business-facts.ts` for evidence extraction and classification
- `packages/core/src/knowledge-base/writer-contracts.ts` for semantic validation
- `packages/core/src/knowledge-base/markdown.ts` for deterministic fallback labeling and richer fallback structure
- `agents/kb-file-writer.md` and related writer prompts for reader-friendly document contracts
- `skills/understand-kb/SKILL.md` for updated operational guidance
- focused tests for classifier behavior, writer validation, and coverage preservation

Implementation should avoid unrelated dashboard, graph rendering, or UI changes.

## Review Notes

The central decision is to improve quality by giving writers better evidence and holding outputs to stronger validation, not by reducing document count or launching many more agents. This preserves the user's priority: same or more documents, but each one should explain the actual business behavior in enough detail for non-technical readers to understand.
