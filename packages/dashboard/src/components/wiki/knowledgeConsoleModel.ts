import {
  evidenceForPage,
  pageTree,
  type WikiEvidenceRecord,
  type WikiIndex,
  type WikiPageRecord,
  type WikiTreeSection,
} from "../../wiki/wikiIndex";

export interface KnowledgeConsoleView {
  activePage: WikiPageRecord | null;
  sections: WikiTreeSection[];
  evidence: WikiEvidenceRecord[];
  graphNodeIds: string[];
  emptyReason: string | null;
}

function activePageFor(index: WikiIndex, activePageId: string | null): WikiPageRecord | null {
  if (activePageId && index.pagesById.has(activePageId)) {
    return index.pagesById.get(activePageId) ?? null;
  }
  return index.pages[0] ?? null;
}

export function buildKnowledgeConsoleView(
  index: WikiIndex,
  activePageId: string | null,
): KnowledgeConsoleView {
  const activePage = activePageFor(index, activePageId);
  const graphNodeIds = activePage
    ? [...activePage.explainedNodeIds, ...activePage.relatedNodeIds]
    : [];
  return {
    activePage,
    sections: pageTree(index),
    evidence: activePage ? evidenceForPage(index, activePage.id) : [],
    graphNodeIds,
    emptyReason: index.pageCount === 0 ? "No generated wiki metadata is available yet." : null,
  };
}
