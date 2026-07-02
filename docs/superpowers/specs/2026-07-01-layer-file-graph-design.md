# Layer File Graph Design

Date: 2026-07-01

## Goal

Replace the readable layer detail file heatmap with a file-level graph view.
When a user clicks a layer from the structural overview, the second screen
should still feel like a graph: files are nodes, relationships are edges, and
the user can inspect direct file relationships without falling back to a plain
list or card grid.

## Current Context

The structural dashboard currently routes through `ReadableViewGraphPage`.
Overview mode renders `LayerOverviewPanel`. Layer detail mode renders
`LayerFileHeatmap`, which shows files as independent cards. File detail then
renders `FunctionDetailPage` and `FunctionMatrixPanel`.

The old `GraphView` still contains the desired edge behavior: ReactFlow-style
Bezier edges, selection highlighting, animation for selected edges, dimmed
unrelated edges, and dashed fallback/external edges. The new readable layer
view should reuse that edge interaction language while presenting clearer,
file-focused nodes.

The dashboard has two theme presets:

- `Engineering Workbench`
- `Technical Document`

The new layer graph must follow theme tokens from these presets instead of
hard-coding a separate visual style.

## Approved Direction

Build a new layer detail graph that replaces `LayerFileHeatmap` in the normal
layer-detail route.

The view shows file nodes inside a graph canvas:

- Each rendered node represents one file.
- Nodes show file name, short path, function count, class count, and complexity.
- Nodes use the active theme preset for background, border, text, and node-type
  colors.
- The graph groups or positions files clearly enough to avoid the old graph's
  clutter, but it remains a graph rather than a card grid.

Edges follow the original understand-anything connection feel with these
corrections:

- Use ReactFlow Bezier-style connections.
- Do not render large arrowheads or `markerEnd` arrows.
- Show direction through the selected/focused edge animation.
- Connect every edge to node border handles, not to node centers or whitespace.
- Use right-side handles for outgoing edges and left-side handles for incoming
  edges by default.
- Allow top, bottom, left, or right handles for return paths when needed to keep
  connections readable.
- Do not render edge labels directly on the canvas.
- Put edge count, type, and source details in a side panel or hover tooltip.

## Relationship Scope

The first implementation is file-level only.

Relationship source priority:

1. Prefer function `calls` edges mapped up to source and target files.
2. If calls are unavailable for the layer scope, fall back to file `imports`
   edges.
3. Mark fallback relationships so they can use dashed styling and explanatory
   text in the detail panel.

Same-file function calls do not create file-level edges. They remain part of
file detail/function inspection.

## Interaction Model

Default layer detail:

- Show all file nodes in the active layer.
- Show all aggregated file relationships when the layer has 120 or fewer
  relationships.
- When a layer has more than 120 aggregated relationships, show the strongest
  120 relationships by count until a file is selected.
- Keep the graph pannable and zoomable.

When a file node is clicked:

- Select the file.
- Highlight every direct incoming and outgoing file relationship for that file.
- Include every direct relationship for the selected file even when the default
  layer view had capped dense relationships.
- Animate the selected/focused relationship lines.
- Dim unrelated nodes and edges.
- Show a side panel with direct upstream/downstream files and relationship
  counts.

When a user opens a file:

- Continue to use the existing file detail route and `FunctionMatrixPanel`.
- The file detail page is out of scope for this change except for navigation
  compatibility.

## Components

Add a focused component for the second layer:

- `LayerFileGraph`
  - Receives the active layer summary, files, search match counts, selected file
    id, and file-open callback.
  - Builds ReactFlow nodes and file-level relationship edges.
  - Owns file selection within the layer graph.
  - Renders the side relationship panel.

Optional small helpers:

- `LayerFileGraphNode`
  - Theme-aware file node with border handles.
- `fileRelationships`
  - Pure viewgraph helper that maps raw graph edges to file-level relationships.

The existing `LayerFileHeatmap` can remain temporarily for reference or tests,
but it should no longer be the default layer-detail renderer after this change.

## Data Flow

1. `setGraph(graph)` still builds `viewGraph`.
2. `ReadableViewGraphPage` chooses overview, layer detail, or file detail from
   store navigation state.
3. In layer-detail mode, it passes active layer files into `LayerFileGraph`.
4. `LayerFileGraph` builds file nodes from `ViewFileSummary`.
5. `LayerFileGraph` builds file edges from raw `calls` or fallback `imports`.
6. Selecting a file updates graph-local focus and may update store
   `selectedNodeId` for sidebar/search compatibility.
7. Opening a file calls the existing `openFileDetail(file.id)`.

## Empty And Error States

- If no graph or view graph exists, keep the existing no-graph state.
- If the active layer id is invalid, show an empty layer state without crashing.
- If a layer has no files, keep the existing localized empty file message.
- If there are no file relationships, render file nodes without edges and show a
  subtle empty relationship state in the side panel.
- If fallback imports are used, label them as estimated relationships in the
  panel or tooltip, not on the canvas.

## Performance

The graph can be large, so relationship derivation should be linear over the
raw edge list and memoized by graph, view graph, and active layer file ids.

Guidelines:

- Build function-to-file lookup once from `viewGraph.functionToFileId`.
- Aggregate relationships by `sourceFileId|targetFileId|source`.
- Avoid per-render `graph.nodes.find` loops inside mapped edge rendering.
- Keep edge labels off the canvas to reduce SVG text layout cost.

## Testing

Add focused tests for relationship derivation:

- Maps function `calls` into directed file-level relationships.
- Preserves direction.
- Counts multiple calls between the same file pair.
- Excludes same-file calls from file-level edges.
- Falls back to imports when calls are unavailable.
- Does not fall back to imports when usable calls exist.

Add component or integration coverage where practical:

- Layer detail renders the file graph instead of the old heatmap.
- Clicking a file focuses its direct relationships.
- Edge detail text appears in the side panel, not as canvas labels.

Manual verification:

- Open the dashboard in `Engineering Workbench`.
- Click a layer and verify the second screen is a file graph.
- Confirm selected/focused edges animate without large arrowheads.
- Confirm every edge visually connects to file node borders.
- Switch to `Technical Document` and verify colors follow the light preset.
- Click a file node and open file detail; the existing function matrix still
  works.
