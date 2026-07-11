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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-root text-text-primary max-lg:flex-col max-lg:overflow-auto">
      <WikiNavigation
        projectName={wikiIndex.payload?.projectName ?? "代码仓库"}
        sections={view.sections}
        activePageId={view.activePage?.id ?? activeWikiPageId}
        emptyReason={view.emptyReason}
        onSelectPage={selectWikiPage}
      />
      <WikiPageView page={view.activePage} emptyReason={view.emptyReason} />
      <WikiEvidenceRail
        page={view.activePage}
        evidence={view.evidence}
        graphNodeIds={view.graphNodeIds}
        onOpenGraph={openGraphForWikiPage}
      />
    </div>
  );
}
