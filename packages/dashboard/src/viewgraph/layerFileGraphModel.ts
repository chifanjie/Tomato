import type { Edge, Node } from "@xyflow/react";
import type { FileRelationship } from "./fileRelationships";
import type { ViewFileSummary } from "./types";

export interface LayerFileFlowModelInput {
  files: ViewFileSummary[];
  relationships: FileRelationship[];
  selectedFileId: string | null;
  fileMatchCounts: Map<string, number>;
  maxDefaultEdges: number;
}

export interface SelectedFileRelationshipDetails {
  file: ViewFileSummary;
  incoming: FileRelationship[];
  outgoing: FileRelationship[];
}

export interface LayerFileGraphNodeData extends Record<string, unknown> {
  file: ViewFileSummary;
  isSelected: boolean;
  isDimmed: boolean;
  searchMatchCount: number;
}

export interface LayerFileFlowModel {
  nodes: Node<LayerFileGraphNodeData, "layer-file">[];
  edges: Edge[];
  selectedDetails: SelectedFileRelationshipDetails | null;
}

function strongestRelationships(relationships: FileRelationship[], maxDefaultEdges: number): FileRelationship[] {
  if (relationships.length <= maxDefaultEdges) return relationships;
  return [...relationships]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.localeCompare(b.id);
    })
    .slice(0, maxDefaultEdges);
}

function visibleRelationships(
  relationships: FileRelationship[],
  selectedFileId: string | null,
  maxDefaultEdges: number,
): FileRelationship[] {
  const visible = new Map<string, FileRelationship>();
  for (const relationship of strongestRelationships(relationships, maxDefaultEdges)) {
    visible.set(relationship.id, relationship);
  }
  if (selectedFileId) {
    for (const relationship of relationships) {
      if (relationship.sourceFileId === selectedFileId || relationship.targetFileId === selectedFileId) {
        visible.set(relationship.id, relationship);
      }
    }
  }
  return [...visible.values()];
}

function edgeStyle(relationship: FileRelationship, selectedFileId: string | null): Edge {
  const focused = selectedFileId === relationship.sourceFileId || selectedFileId === relationship.targetFileId;
  const faded = Boolean(selectedFileId) && !focused;
  const fallback = relationship.source === "imports";
  const stroke = focused
    ? "var(--color-accent-bright)"
    : faded
      ? "var(--color-edge-dim)"
      : "var(--color-edge)";
  return {
    id: relationship.id,
    source: relationship.sourceFileId,
    target: relationship.targetFileId,
    sourceHandle: "right",
    targetHandle: "left",
    animated: focused,
    style: {
      stroke,
      strokeWidth: focused ? 2.8 : Math.min(1.2 + Math.log2(relationship.count + 1), 3.8),
      ...(fallback ? { strokeDasharray: "5 5" } : {}),
    },
  };
}

export function buildLayerFileFlowModel({
  files,
  relationships,
  selectedFileId,
  fileMatchCounts,
  maxDefaultEdges,
}: LayerFileFlowModelInput): LayerFileFlowModel {
  const relationshipList = visibleRelationships(relationships, selectedFileId, maxDefaultEdges);
  const selectedFile = selectedFileId ? files.find((file) => file.id === selectedFileId) ?? null : null;
  const relatedToSelected = new Set<string>();
  if (selectedFileId) {
    relatedToSelected.add(selectedFileId);
    for (const relationship of relationships) {
      if (relationship.sourceFileId === selectedFileId) relatedToSelected.add(relationship.targetFileId);
      if (relationship.targetFileId === selectedFileId) relatedToSelected.add(relationship.sourceFileId);
    }
  }

  const nodes: Node<LayerFileGraphNodeData, "layer-file">[] = files.map((file) => ({
    id: file.id,
    type: "layer-file",
    position: { x: 0, y: 0 },
    data: {
      file,
      isSelected: file.id === selectedFileId,
      isDimmed: Boolean(selectedFileId) && !relatedToSelected.has(file.id),
      searchMatchCount: fileMatchCounts.get(file.id) ?? 0,
    },
  }));

  const edges = relationshipList.map((relationship) => edgeStyle(relationship, selectedFileId));

  return {
    nodes,
    edges,
    selectedDetails: selectedFile
      ? {
          file: selectedFile,
          incoming: relationships.filter((relationship) => relationship.targetFileId === selectedFile.id),
          outgoing: relationships.filter((relationship) => relationship.sourceFileId === selectedFile.id),
        }
      : null,
  };
}
