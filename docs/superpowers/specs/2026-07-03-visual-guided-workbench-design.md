# Visual Guided Workbench Design

Date: 2026-07-03
Status: Ready for user review

## Goal

Upgrade the dashboard from a graph viewer into a visual guided workbench for
engineers taking over a codebase.

The new experience should still center the generated code graph, but it should
feel more like a product interface:

- a clear reading route
- a larger visual stage for layers, files, paths, and selected context
- a right-side explanation panel powered by the generated knowledge base
- stronger visual hierarchy, progress, next-step cues, and selected-state
  feedback

The knowledge base is a content layer. It should explain what the selected
graph item means, why it matters, what may be risky to change, and where the
evidence lives. It should not replace the visual graph as the primary
navigation model.

## Current Context

The dashboard currently routes through `ReadableViewGraphPage` for the
structural view.

Existing structural flow:

1. `LayerOverviewPanel` shows a list-like layer overview.
2. Selecting a layer opens `LayerFileGraph`, a file-level React Flow graph.
3. Opening a file shows `FunctionDetailPage` and `FunctionMatrixPanel`.
4. The right sidebar changes by persona, using components such as
   `ReadingAssistantPanel`, `LearnPanel`, `ProjectOverview`, `NodeInfo`, and
   `FileExplorer`.

Recent work also generated a Markdown knowledge base under
`.understand-anything/knowledge-base/`, including:

- business capability documents
- business flow documents
- module capability documents
- key function topic documents
- trace artifacts and coverage maps

Prior knowledge-base designs established an important product principle:
reader-facing docs should be business narrative and implementation explanation,
while graph evidence and trace data remain available on the side.

This design applies that principle to the frontend.

## Design Direction

Build a **Visual Guided Workbench** for desktop structural mode.

The workbench has four regions:

1. **Mode Rail**
   - A narrow left rail for high-level app modes.
   - Keeps global navigation compact and visually stable.
   - Initial entries can be structural journey, knowledge context, risk/changes,
     search, and settings/theme.

2. **Journey Rail**
   - A wider left panel showing the recommended reading route.
   - Shows current step, progress, next suggested step, and related knowledge
     documents.
   - Uses graph-derived steps rather than static onboarding copy.

3. **Visual Stage**
   - The central, largest area.
   - Shows the current layer, file graph, selected path, or function impact
     view with stronger focus states.
   - Keeps pan/zoom graph affordances, but adds a more deliberate stage header,
     selected-context summary, and path controls.

4. **Knowledge Context Panel**
   - A right panel that explains the current selection.
   - Defaults to an engineer handoff perspective, with business meaning and
     change risk as supporting sections.
   - Provides evidence links into source anchors, generated docs, and trace
     artifacts.

## Reader Priority

The default reader is an engineer taking over the project.

The panel should first answer:

- What is this layer, file, function, or path responsible for?
- Where should I look next?
- Which upstream/downstream code depends on this?
- What would be risky to change?

It should then add:

- What business capability or workflow does this support?
- What rules or trigger conditions were found in the knowledge base?
- Which claims are inferred or need confirmation?

## Page Structure

### Mode Rail

The rail should be visually compact and icon-led.

Initial modes:

- Structure/Journey
- Knowledge
- Risk/Change
- Search
- Settings/Theme

Only Structure/Journey needs to be fully implemented first. Other entries may
open existing surfaces or stay hidden until they have real behavior.
No visible explanatory marketing text should be added in-app.

### Journey Rail

The journey rail turns the current graph into a readable route.

It should show:

- project title or current scope
- current route name
- progress indicator
- route steps
- current step highlight
- next step callout
- related generated documents

Step types:

- Project overview
- Layer
- File
- Function or class
- Impact path
- Risk/checkpoint

Route generation should initially be deterministic:

1. Start from layer summaries.
2. Prioritize layers with more files, functions, search matches, or high
   complexity.
3. Within a layer, prioritize files with entry points, many functions, high
   inbound/outbound relationships, or matching knowledge docs.
4. Within a file, prioritize exported, high-connectivity, or complex functions.

The journey rail should not become a long document list. It should show a small
curated path and link to full knowledge documents from the context panel.

### Visual Stage

The central area should become more visually deliberate than the current
list/card-like overview.

Layer overview should move toward a stage-like structural map:

- layer nodes or bands arranged by dependency direction
- visible relationship strength or dependency count
- selected layer summary overlay
- search matches and risk signals as badges, not large text blocks

Layer detail should keep `LayerFileGraph`, but improve presentation:

- prominent stage header with layer name and route position
- clearer selected file path
- stronger dimming/highlighting for direct relationships
- bottom or floating summary strip for selected path stats
- fewer competing side panels inside the graph itself

File detail should keep `FunctionMatrixPanel`, but align with the workbench:

- journey rail remains visible on desktop
- the right knowledge panel replaces isolated explanatory side content where
  practical
- selected function gets a clear handoff summary and risk section

### Knowledge Context Panel

The right panel should be structured as cards:

1. **Engineer Handoff**
   - plain-language responsibility
   - entry points or callers
   - downstream dependencies
   - next recommended source file/function

2. **Business Meaning**
   - matching business capability or flow
   - trigger conditions or rules when available
   - confidence or confirmation notes when needed

3. **Change Risk**
   - risky dependencies
   - high-complexity functions
   - missing evidence, unresolved calls, or weak business labels

4. **Evidence Links**
   - source file and line anchors when available
   - related generated Markdown docs
   - trace records or coverage report entries

When no knowledge-base match exists, the panel should still explain the graph
selection from local graph facts and show a useful empty state:

> No generated knowledge document is linked yet. Showing graph-derived context.

## Knowledge Matching

The first implementation should avoid a heavy new indexing system. It can match
knowledge documents using existing stable identifiers and filenames.

Recommended sources:

- `.understand-anything/knowledge-base/业务能力索引.md`
- `.understand-anything/knowledge-base/业务流程地图.md`
- `.understand-anything/knowledge-base/能力文档/*.md`
- `.understand-anything/knowledge-base/关键函数专题/*.md`
- `.understand-anything/knowledge-base/.trace/document-traces.json`
- `.understand-anything/knowledge-base/.trace/coverage-map.json`

Matching priority:

1. Trace `coveredNodeIds` contains the selected graph node id.
2. Trace `coveredFilePaths` contains the selected file path.
3. Generated document filename maps to normalized file path, module path, or
   function name.
4. Business capability or flow document references related nodes or paths.
5. Fallback to graph-only context.

The UI should surface the match confidence:

- Direct trace match
- Filename/path match
- Related business document
- Graph-only context

## Data Flow

1. `Dashboard` loads graph data as it does today.
2. The app optionally fetches knowledge-base manifest/trace files when present.
3. A lightweight `knowledgeContext` model indexes document metadata and trace
   records.
4. The structural view builds journey steps from `viewGraph`, graph stats, and
   optional knowledge matches.
5. Selecting a layer, file, function, or path updates the current workbench
   selection.
6. `KnowledgeContextPanel` resolves the best explanation packet for that
   selection.
7. The visual stage highlights the selected item and direct route/path context.

## Components

Suggested component boundaries:

- `VisualGuidedWorkbench`
  - desktop structural layout shell
  - owns current route display and workbench selection wiring

- `ModeRail`
  - compact app mode navigation

- `JourneyRail`
  - reading route, progress, step selection, related docs callout

- `VisualStage`
  - wrapper around layer overview, layer file graph, and file/function detail
  - supplies stage header and selected-context summary

- `KnowledgeContextPanel`
  - engineer handoff, business meaning, change risk, evidence links

- `buildJourneyRoute`
  - pure helper that derives route steps from `ViewGraph` and graph stats

- `buildKnowledgeContext`
  - pure helper that maps graph selections to knowledge documents and trace
    records

Existing components should be reused where possible. This is a product shell
and interaction upgrade, not a replacement of all graph logic.

## Visual Language

The UI should use the existing theme tokens and avoid introducing a separate
brand palette.

Direction:

- compact, professional workbench
- stronger central visual focus
- clearer selected states
- restrained cards only for repeated items and context blocks
- no decorative blobs or marketing hero composition
- no giant explanatory text inside the app

The current dark engineering theme can remain the primary reference, but the
design must also work with the light `Technical Document` preset.

## Responsive Behavior

Desktop:

- four-region layout
- mode rail and journey rail visible
- knowledge context panel visible
- visual stage gets the largest width

Tablet/narrow desktop:

- mode rail remains
- journey rail can collapse to icons/step list
- context panel can become a drawer

Mobile:

- reuse existing mobile layout patterns
- do not force the full workbench layout onto small screens
- expose route, stage, and context as tabs or bottom-sheet surfaces

## Empty And Error States

No graph:

- keep existing no-graph state.

No journey candidates:

- show project overview and graph-only context.

No knowledge base:

- keep all visual workbench functionality.
- panel says knowledge docs are not available and uses graph-derived context.

Knowledge trace parse failure:

- do not break graph navigation.
- show a non-blocking warning in the context panel.

Selection has no matching docs:

- show graph-derived handoff and evidence links available from graph/source
  metadata.

## Testing

Unit tests:

- route generation prioritizes layers, files, and functions deterministically
- route generation handles empty graphs and empty layers
- knowledge matching prefers trace node ids over filename matches
- knowledge matching falls back to graph-only context
- risk summary flags high complexity and unresolved/missing evidence

Component tests:

- workbench renders journey rail, visual stage, and context panel in structural
  desktop mode
- selecting a journey step updates visual selection
- selecting a graph file updates the context panel
- missing knowledge base does not crash the workbench
- direct trace matches show evidence links

Manual verification:

- open desktop dashboard in Engineering Workbench theme
- verify the first screen reads as a visual guided workbench, not a plain list
- click through layer, file, and function selections
- confirm the right panel updates with engineer handoff, business meaning,
  change risk, and evidence links
- switch to Technical Document theme and verify text, borders, and contrast
- verify mobile still uses an appropriate compact layout

## Acceptance Criteria

1. Structural desktop mode visually changes from a list/sidebar dashboard into
   a guided workbench.
2. The graph remains the primary navigation and visual focus.
3. A journey rail shows a deterministic recommended reading path and progress.
4. The right context panel explains selected graph items using graph facts and
   generated knowledge-base documents when present.
5. The dashboard remains usable when no knowledge base exists.
6. Selection changes are visually obvious in the stage and context panel.
7. Existing layer, file, and function navigation remains available.
8. Theme tokens are respected in both dark and light presets.
9. Tests cover route generation, knowledge matching, and key UI states.
