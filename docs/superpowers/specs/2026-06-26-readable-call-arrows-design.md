# Readable Call Arrows Design

Date: 2026-06-26

## Goal

Restore the old graph's useful directional call arrows without losing the newer readable dashboard's strengths: clear layer navigation, file cards, function volume, and function matrix reading.

The selected direction is A + C:

- Add a file-level call arrow overlay to the readable layer view.
- Add a function-level call mini-map to the file detail view.

## Current Context

The readable view currently uses:

- `ReadableViewGraphPage` for layer overview and layer detail routing.
- `LayerOverviewPanel` for project/layer cards.
- `LayerFileHeatmap` for file cards with function/class/import counts.
- `FunctionDetailPage` and `FunctionMatrixPanel` for function-level inspection.
- `viewgraph/buildViewGraph.ts` to build file/function summaries.
- `viewgraph/functionImpact.ts` to compute upstream/downstream impact.

The old arrow behavior still exists in `GraphView.tsx` through React Flow and ELK layout. It supports directional edges, aggregation, selected-edge highlighting, and container expansion. The new readable view does not render those edges on the main canvas, so the user can see function volume but not call direction.

## User Experience

### Layer Detail

The layer detail page keeps the current file-card experience but gains a call relationship overlay.

The overlay draws directional arrows between file cards:

- If function call data exists, a file arrow means at least one function in source file calls at least one function in target file.
- If no function call data exists, the overlay can fall back to file import edges and label the relationship as estimated.
- Arrow thickness represents aggregated edge count.
- Arrow color distinguishes real `calls` from fallback `imports`.

The overlay must not make the view unreadable. It should support:

- A visible toggle: show/hide call arrows.
- Focus behavior: arrows are revealed by focusing a concrete file, not by drawing the entire layer's relationships by default.
- Complete direct relationships: once a file is focused, every directly related incoming/outgoing call relationship for that file should be available as an arrow.

Default reveal rule:

- The default layer view shows file cards and function volume without global arrows.
- Clicking a file card reveals all direct incoming and outgoing file-level arrows for that file.
- Hovering a file may preview those direct arrows, but click locks the focus.
- Clicking empty canvas or a close action clears the focused arrows.
- If a focused file has many direct relationships, the arrows are still represented; visual clutter is handled with grouping, bundling, curved parallel paths, or an adjacent relationship list rather than dropping relationships.

### Arrow Visual Style

Arrow form must match the previous understand-anything graph style rather than introduce a new visual language.

- Render arrows as ReactFlow-style curved SVG edges with arrowheads. If the new readable overlay is implemented as raw SVG rather than ReactFlow edges, it should still visually mimic the old ReactFlow edge shape.
- Use the same warm gold edge family already used by `GraphView.tsx`.
- Base file/function arrows use the old muted gold treatment: roughly `rgba(212,165,116,0.4-0.5)` with `1.5px` stroke.
- Aggregated file arrows may scale stroke width by relationship count using the old logarithmic feel, but this affects visual weight only and must not hide or cap relationships.
- Focused/selected arrows use the stronger old selected-edge treatment: roughly `rgba(212,165,116,0.8)`, thicker stroke, animated emphasis, and gold labels.
- Unrelated visible arrows, when any are shown around a focus set, fade the same way the old graph fades non-selected edges.
- Estimated import fallback arrows use the old dashed external/portal treatment.
- Labels follow the old muted/gold label treatment: muted base labels and brighter focused labels.

### File Detail

The file detail page gains a function call mini-map near the existing function matrix.

The mini-map shows:

- Calls between functions inside the current file.
- The selected function in the center or visually emphasized.
- One-hop upstream callers and downstream callees.
- Cross-file calls as compact external nodes or grouped file pills.

Default mini-map density rule:

- The default mini-map is driven by the selected function.
- Show every direct incoming and outgoing call for the selected function.
- Same-file direct calls render as function nodes with arrows.
- Cross-file direct calls render as function nodes when practical; otherwise group by external file while preserving the relationship count and allowing drill-in.
- Larger neighborhoods use grouping and scrolling, not silent truncation.

The function matrix remains the main way to scan function volume. The mini-map is the relationship layer, not a replacement for the matrix.

Clicking a function dot in the matrix updates:

- Selected function details.
- Upstream/downstream counts.
- Highlighted paths in the mini-map.
- Related function/file lists already shown in the right panel.

## Data Model

Add a small viewgraph relationship helper rather than embedding graph parsing in UI components.

Suggested module:

`packages/dashboard/src/viewgraph/callRelationships.ts`

Types:

```ts
export type CallRelationshipSource = "calls" | "imports";

export interface FileCallEdge {
  sourceFileId: string;
  targetFileId: string;
  source: CallRelationshipSource;
  count: number;
  // Empty for import fallback edges.
  functionEdgeIds: string[];
}

export interface FunctionCallEdge {
  sourceFunctionId: string;
  targetFunctionId: string;
  sourceFileId: string | null;
  targetFileId: string | null;
  source: "calls";
}

export interface FunctionCallNeighborhood {
  selectedFunctionId: string;
  incoming: FunctionCallEdge[];
  outgoing: FunctionCallEdge[];
  intraFile: FunctionCallEdge[];
  externalFileIds: string[];
}
```

Core helpers:

- `buildFileCallEdges(graph, viewGraph, options)` maps function calls to file-level aggregated arrows.
- `buildFunctionCallEdges(graph, viewGraph, fileId)` returns function-level calls relevant to a file.
- `buildFunctionCallNeighborhood(graph, viewGraph, functionId)` returns one-hop focus data for the selected function.

Fallback behavior:

- Prefer `calls` edges.
- Use `imports` only when there are no usable `calls` edges for the current scope.
- Mark fallback edges as `source: "imports"` so UI can label them as estimated.

## Components

### Layer Call Overlay

Add a component:

`LayerCallOverlay`

Responsibilities:

- Receive rendered file layout anchors from `LayerFileHeatmap`.
- Draw arrows over the card grid using the previous understand-anything edge form.
- Keep pointer events minimal so file cards remain easy to click.
- Render arrows only for the focused/hovered file relationship set.
- Preserve all direct focused relationships by grouping or bundling dense sets instead of filtering them out.

`LayerFileHeatmap` will need stable refs or measured card positions for file cards. The overlay should be an absolutely positioned SVG inside the heatmap container.

### Function Call Mini Map

Add a component:

`FunctionCallMiniMap`

Responsibilities:

- Render selected function, incoming callers, outgoing callees, and same-file calls.
- Show direction clearly with arrowheads.
- Reuse the previous understand-anything arrow styling so the mini-map feels like the same graph system at a smaller scale.
- Use compact nodes so it fits beside or below the matrix.
- On small screens, stack below the matrix instead of forcing a cramped three-column layout.

`FunctionDetailPage` should pass the selected function id and the file summary into this component.

## Data Flow

1. Raw graph loads in `App`.
2. `setGraph` builds `viewGraph`.
3. `LayerFileHeatmap` reads current files and asks `callRelationships` for file-level edges.
4. `LayerCallOverlay` draws file-level arrows based on measured card positions.
5. `FunctionDetailPage` tracks `selectedFunctionId`.
6. `FunctionCallMiniMap` reads one-hop function relationships for the selected function.

## Error And Empty States

- If no `calls` and no `imports` exist, show no arrows and display a subtle "No call edges found" state only where useful.
- If card positions are not measured yet, skip overlay rendering until after layout.
- If a focused relationship set is dense, group or bundle arrows and provide a relationship list so every direct relationship remains discoverable.
- If fallback imports are used, label them as estimated dependency arrows.

## Performance

The graph can be large, so relationship building must be memoized and linear over relevant edges.

Guidelines:

- Build function-to-file maps once per graph/viewGraph.
- Aggregate file edges with maps keyed by `sourceFileId|targetFileId|source`.
- Avoid drawing global layer arrows until a file is focused.
- Recompute SVG paths only when file card positions, focused file, or relationship data changes.

## Testing

Add focused tests for the relationship helper:

- Maps `calls` function edges into aggregated file-level edges.
- Preserves direction.
- Counts multiple calls between the same file pair.
- Falls back to `imports` when calls are unavailable.
- Builds incoming/outgoing neighborhoods for a selected function.
- Excludes edges whose functions cannot be mapped to files.

Add component or integration tests where practical:

- Layer overlay receives all direct focused file edges.
- Function mini-map updates when selected function changes.

Manual/browser verification:

- Layer detail shows file cards first, then reveals directional arrows when a file is clicked.
- Toggle hides/shows arrows.
- Selecting a file shows all direct incoming and outgoing arrows for that file.
- File detail shows the selected function and upstream/downstream arrows.
- Mobile layout remains usable.

## Out Of Scope

- Replacing the readable view with the old `GraphView`.
- Building a full general-purpose graph editor.
- Showing every function call edge globally before the user focuses a file or function.
- Changing backend graph generation.

## Acceptance Criteria

- Users can see function volume and call direction in the same workflow.
- Layer detail shows readable file cards plus focused directional file-level arrows.
- File detail shows function-level upstream/downstream arrows.
- Arrow visibility is controlled by focus, while focused direct relationships are preserved rather than capped away.
- Arrow shape, color, selected state, dashed fallback state, and label treatment match the previous understand-anything ReactFlow arrows.
- Existing readable navigation, search, theme switching, and mode controls continue to work.
