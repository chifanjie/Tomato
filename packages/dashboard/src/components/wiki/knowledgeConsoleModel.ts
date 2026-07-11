import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import {
  buildWikiNavigation,
  type WikiNavigationModel,
} from "../../wiki/navigationModel";
import { evidenceForPage, type WikiRuntimeIndex } from "../../wiki/wikiIndex";

export interface KnowledgeConsoleView {
  navigation: WikiNavigationModel;
  activePage: WikiPageV2 | null;
  directGraphNodeIds: readonly string[];
  contextNodeIds: readonly string[];
  exactEvidence: readonly WikiEvidenceV2[];
  homeVisible: boolean;
}

function activePageFor(
  index: WikiRuntimeIndex,
  activePageId: string | null,
): WikiPageV2 | null {
  if (activePageId === null) return null;
  if (index.pagesById.has(activePageId)) {
    return index.pagesById.get(activePageId) ?? null;
  }
  return index.pages[0] ?? null;
}

export function buildKnowledgeConsoleView(
  index: WikiRuntimeIndex,
  activePageId: string | null,
): KnowledgeConsoleView {
  const activePage = activePageFor(index, activePageId);
  const directGraphNodeIds = activePage
    ? [...new Set(activePage.directNodeIds)]
    : [];
  const directNodeIds = new Set(directGraphNodeIds);
  const contextNodeIds = activePage
    ? [...new Set(activePage.contextNodeIds.filter((nodeId) => !directNodeIds.has(nodeId)))]
    : [];
  const exactEvidence = activePage
    ? evidenceForPage(index, activePage.id).filter((evidence) =>
      evidence.nodeIds.some((nodeId) => directNodeIds.has(nodeId)),
    )
    : [];

  return {
    navigation: buildWikiNavigation(index),
    activePage,
    directGraphNodeIds,
    contextNodeIds,
    exactEvidence,
    homeVisible: activePageId === null,
  };
}
