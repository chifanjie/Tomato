import type { ViewMode } from "../store";

export interface GraphControlVisibilityInput {
  viewMode: ViewMode;
  isKnowledgeGraph: boolean;
}

export function shouldShowGraphControls({
  viewMode,
  isKnowledgeGraph,
}: GraphControlVisibilityInput): boolean {
  return viewMode !== "structural" || isKnowledgeGraph;
}
