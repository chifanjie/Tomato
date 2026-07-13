import { primaryDestinationForNode } from "@understand-code/core/knowledge-base";
import type { KnowledgeGraph } from "@understand-code/core/types";
import { create } from "zustand";
import type { WikiTarget } from "./wiki/wikiContent";
import {
  emptyWikiRuntimeIndex,
  type WikiRuntimeIndex,
} from "./wiki/wikiIndex";

export type DashboardSurface = "wiki" | "graph";
export type GraphExplorerMode = "architecture" | "call" | "coverage";

interface DashboardStore {
  graph: KnowledgeGraph | null;
  selectedNodeId: string | null;
  dashboardSurface: DashboardSurface;
  wikiIndex: WikiRuntimeIndex;
  activeWikiPageId: string | null;
  pendingWikiAnchor: string | null;
  graphExplorerMode: GraphExplorerMode;
  graphFocusNodeIds: string[];
  graphFocusPageId: string | null;
  graphWikiNotice: string | null;
  setConsoleGraph: (graph: KnowledgeGraph) => void;
  setDashboardSurface: (surface: DashboardSurface) => void;
  setWikiIndex: (index: WikiRuntimeIndex) => void;
  selectWikiPage: (pageId: string | null, anchor?: string | null) => void;
  openWikiTarget: (target: WikiTarget) => void;
  consumePendingWikiAnchor: (anchor: string) => void;
  selectNode: (nodeId: string | null) => void;
  setGraphExplorerMode: (mode: GraphExplorerMode) => void;
  openGraphForWikiPage: (pageId: string) => void;
  clearGraphFocus: () => void;
  openWikiForGraphNode: (nodeId: string) => WikiTarget | null;
}

function wikiPageDirectNodeIds(index: WikiRuntimeIndex, pageId: string): string[] {
  const page = index.pagesById.get(pageId);
  return page ? [...new Set(page.directNodeIds)] : [];
}

export const useDashboardStore = create<DashboardStore>()((set, get) => ({
  graph: null,
  selectedNodeId: null,
  dashboardSurface: "wiki",
  wikiIndex: emptyWikiRuntimeIndex(),
  activeWikiPageId: null,
  pendingWikiAnchor: null,
  graphExplorerMode: "architecture",
  graphFocusNodeIds: [],
  graphFocusPageId: null,
  graphWikiNotice: null,

  setConsoleGraph: (graph) => set({ graph }),

  setDashboardSurface: (surface) => set({
    dashboardSurface: surface,
    graphWikiNotice: null,
    ...(surface === "graph"
      ? {
          pendingWikiAnchor: null,
          graphFocusNodeIds: [],
          graphFocusPageId: null,
        }
      : {}),
  }),

  setWikiIndex: (index) => set((state) => {
    const activePageExists = state.activeWikiPageId
      ? index.pagesById.has(state.activeWikiPageId)
      : false;
    const focusedPageExists = state.graphFocusPageId
      ? index.pagesById.has(state.graphFocusPageId)
      : false;
    return {
      wikiIndex: index,
      activeWikiPageId: activePageExists ? state.activeWikiPageId : null,
      pendingWikiAnchor: activePageExists ? state.pendingWikiAnchor : null,
      graphFocusPageId: focusedPageExists ? state.graphFocusPageId : null,
      graphFocusNodeIds: focusedPageExists && state.graphFocusPageId
        ? wikiPageDirectNodeIds(index, state.graphFocusPageId)
        : [],
      graphWikiNotice: null,
    };
  }),

  selectWikiPage: (pageId, anchor = null) => set({
    activeWikiPageId: pageId,
    pendingWikiAnchor: anchor,
    graphWikiNotice: null,
  }),

  openWikiTarget: (target) => set((state) => (
    state.wikiIndex.pagesById.has(target.pageId)
      ? {
          dashboardSurface: "wiki" as const,
          activeWikiPageId: target.pageId,
          pendingWikiAnchor: target.anchor ?? null,
          graphWikiNotice: null,
        }
      : {}
  )),

  consumePendingWikiAnchor: (anchor) => set((state) => (
    state.pendingWikiAnchor === anchor ? { pendingWikiAnchor: null } : {}
  )),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, graphWikiNotice: null }),

  setGraphExplorerMode: (mode) => set({ graphExplorerMode: mode }),

  openGraphForWikiPage: (pageId) => set((state) => {
    if (!state.wikiIndex.pagesById.has(pageId)) return {};
    return {
      dashboardSurface: "graph" as const,
      activeWikiPageId: pageId,
      pendingWikiAnchor: null,
      graphExplorerMode: "architecture" as const,
      graphFocusNodeIds: wikiPageDirectNodeIds(state.wikiIndex, pageId),
      graphFocusPageId: pageId,
      graphWikiNotice: null,
    };
  }),

  clearGraphFocus: () => set({
    graphFocusNodeIds: [],
    graphFocusPageId: null,
    graphWikiNotice: null,
  }),

  openWikiForGraphNode: (nodeId) => {
    const state = get();
    const destination = state.wikiIndex.payload
      ? primaryDestinationForNode(state.wikiIndex.payload, nodeId) ?? null
      : null;
    if (!destination) {
      set({ selectedNodeId: nodeId, graphWikiNotice: "暂无专门正文" });
      return null;
    }
    state.openWikiTarget(destination);
    set({ selectedNodeId: nodeId, graphWikiNotice: null });
    return destination;
  },
}));
