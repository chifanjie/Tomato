import { useRef, useState } from "react";
import { useDashboardStore } from "../../store";
import { buildKnowledgeConsoleView } from "./knowledgeConsoleModel";
import WikiEvidenceRail from "./WikiEvidenceRail";
import WikiNavigation from "./WikiNavigation";
import WikiPageView from "./WikiPageView";

export default function KnowledgeConsole() {
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const activeWikiPageId = useDashboardStore((state) => state.activeWikiPageId);
  const selectWikiPage = useDashboardStore((state) => state.selectWikiPage);
  const openGraphForWikiPage = useDashboardStore((state) => state.openGraphForWikiPage);
  const view = buildKnowledgeConsoleView(wikiIndex, activeWikiPageId);
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const referenceTriggerRef = useRef<HTMLButtonElement>(null);
  const emptyReason = wikiIndex.pageCount === 0
    ? "还没有生成可阅读的知识库内容。"
    : null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-root text-text-primary max-lg:flex-col max-lg:overflow-auto">
      <WikiNavigation
        model={view.navigation}
        activePageId={view.activePage?.id ?? activeWikiPageId}
        referenceExpanded={referenceExpanded}
        referenceTriggerRef={referenceTriggerRef}
        onReferenceExpandedChange={setReferenceExpanded}
        onSelectHome={() => selectWikiPage(null)}
        onSelectStatus={() => {
          const statusPage = view.navigation.maintenance.pages[0];
          if (statusPage) selectWikiPage(statusPage.id);
        }}
        onSelectPage={selectWikiPage}
      />
      <WikiPageView page={view.activePage} emptyReason={emptyReason} />
      <WikiEvidenceRail
        page={view.activePage}
        evidence={[...view.exactEvidence]}
        graphNodeIds={[...view.directGraphNodeIds]}
        onOpenGraph={openGraphForWikiPage}
      />
    </div>
  );
}
