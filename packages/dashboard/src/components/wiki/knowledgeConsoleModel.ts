import {
  contextPagesForNode,
  directPagesForNode,
  evidenceForNode as coreEvidenceForNode,
  type WikiEvidenceV2,
  type WikiPageV2,
} from "@understand-code/core/knowledge-base";
import {
  buildWikiNavigation,
  type WikiNavigationModel,
} from "../../wiki/navigationModel";
import type { WikiRuntimeIndex } from "../../wiki/wikiIndex";

export interface KnowledgeConsoleView {
  navigation: WikiNavigationModel;
  activePage: WikiPageV2 | null;
  directGraphNodeIds: readonly string[];
  contextNodeIds: readonly string[];
  directPages: readonly WikiPageV2[];
  contextPages: readonly WikiPageV2[];
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
  const directPages: WikiPageV2[] = [];
  const contextPages: WikiPageV2[] = [];
  const exactEvidence: WikiEvidenceV2[] = [];

  if (activePage && index.payload) {
    const seenDirectPageIds = new Set<string>();
    const seenEvidenceIds = new Set<string>();
    for (const nodeId of directGraphNodeIds) {
      for (const page of directPagesForNode(index.payload, nodeId)) {
        if (seenDirectPageIds.has(page.id)) continue;
        seenDirectPageIds.add(page.id);
        if (page.id !== activePage.id) directPages.push(page);
      }
      for (const evidence of coreEvidenceForNode(index.payload, nodeId)) {
        if (seenEvidenceIds.has(evidence.id)) continue;
        seenEvidenceIds.add(evidence.id);
        exactEvidence.push(evidence);
      }
    }

    const seenContextPageIds = new Set<string>();
    for (const nodeId of directGraphNodeIds) {
      for (const page of contextPagesForNode(index.payload, nodeId)) {
        if (
          page.id === activePage.id
          || seenDirectPageIds.has(page.id)
          || seenContextPageIds.has(page.id)
        ) continue;
        seenContextPageIds.add(page.id);
        contextPages.push(page);
      }
    }
  }

  return {
    navigation: buildWikiNavigation(index),
    activePage,
    directGraphNodeIds,
    contextNodeIds,
    directPages,
    contextPages,
    exactEvidence,
    homeVisible: activePageId === null,
  };
}
