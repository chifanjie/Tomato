import {
  categorySections,
  evidenceForPage,
  type WikiRuntimeIndex,
  type WikiTreeSection,
} from "../../wiki/wikiIndex";
import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";

export interface KnowledgeConsoleView {
  activePage: WikiPageV2 | null;
  sections: WikiTreeSection[];
  evidence: WikiEvidenceV2[];
  graphNodeIds: string[];
  emptyReason: string | null;
}

function activePageFor(index: WikiRuntimeIndex, activePageId: string | null): WikiPageV2 | null {
  if (activePageId && index.pagesById.has(activePageId)) {
    return index.pagesById.get(activePageId) ?? null;
  }
  return index.pages[0] ?? null;
}

export function buildKnowledgeConsoleView(
  index: WikiRuntimeIndex,
  activePageId: string | null,
): KnowledgeConsoleView {
  const activePage = activePageFor(index, activePageId);
  const graphNodeIds = activePage
    ? [...new Set(activePage.directNodeIds)]
    : [];
  return {
    activePage,
    sections: categorySections(index),
    evidence: activePage ? evidenceForPage(index, activePage.id) : [],
    graphNodeIds,
    emptyReason: index.pageCount === 0 ? "还没有生成可阅读的知识库内容。" : null,
  };
}
