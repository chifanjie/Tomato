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
- Focus behavior: selecting or hovering a file emphasizes that file's incoming and outgoing arrows.
- Density control: cap initial displayed arrows to the strongest or currently relevant edges.

Default density rule:

- Show at most 40 file-level arrows before a file is focused.
- Sort by `count` descending, then stable file path order.
- When a file is focused, always show its direct incoming and outgoing arrows, even if they are outside the global top 40.

### File Detail

The file detail page gains a function call mini-map near the existing function matrix.

The mini-map shows:

- Calls between functions inside the current file.
- The selected function in the center or visually emphasized.
- One-hop upstream callers and downstream callees.
- Cross-file calls as compact external nodes or grouped file pills.

Default mini-map density rule:

- Show all same-file calls for the selected function neighborhood when the total is 30 or fewer.
- When the neighborhood is larger, show the selected function, the top 12 incoming callers, the top 12 outgoing callees, and grouped overflow pills per external file.

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
- Draw SVG arrows over the card grid.
- Keep pointer events minimal so file cards remain easy to click.
- Highlight arrows related to the selected/hovered file.
- Hide or collapse low-priority edges when density is high.

`LayerFileHeatmap` will need stable refs or measured card positions for file cards. The overlay should be an absolutely positioned SVG inside the heatmap container.

### Function Call Mini Map

Add a component:

`FunctionCallMiniMap`

Responsibilities:

- Render selected function, incoming callers, outgoing callees, and same-file calls.
- Show direction clearly with arrowheads.
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
- If there are too many arrows, show a capped subset and indicate that the view is focused on strongest or selected relationships.
- If fallback imports are used, label them as estimated dependency arrows.

## Performance

The graph can be large, so relationship building must be memoized and linear over relevant edges.

Guidelines:

- Build function-to-file maps once per graph/viewGraph.
- Aggregate file edges with maps keyed by `sourceFileId|targetFileId|source`.
- Cap initial visible layer arrows.
- Recompute SVG paths only when file card positions, selected file, or relationship data changes.

## Testing

Add focused tests for the relationship helper:

- Maps `calls` function edges into aggregated file-level edges.
- Preserves direction.
- Counts multiple calls between the same file pair.
- Falls back to `imports` when calls are unavailable.
- Builds incoming/outgoing neighborhoods for a selected function.
- Excludes edges whose functions cannot be mapped to files.

Add component or integration tests where practical:

- Layer overlay receives only capped/relevant file edges.
- Function mini-map updates when selected function changes.

Manual/browser verification:

- Layer detail shows file cards and directional arrows together.
- Toggle hides/shows arrows.
- Selecting a file emphasizes only related arrows.
- File detail shows the selected function and upstream/downstream arrows.
- Mobile layout remains usable.

## Out Of Scope

- Replacing the readable view with the old `GraphView`.
- Building a full general-purpose graph editor.
- Showing every function call edge at all zoom levels by default.
- Changing backend graph generation.

## Acceptance Criteria

- Users can see function volume and call direction in the same workflow.
- Layer detail shows readable file cards plus directional file-level arrows.
- File detail shows function-level upstream/downstream arrows.
- Arrow density is controlled enough that the view remains readable.
- Existing readable navigation, search, theme switching, and mode controls continue to work.
