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
    <div className="flex min-h-0 flex-1 overflow-hidden bg-root text-text-primary">
      <WikiNavigation
        projectName={wikiIndex.payload?.projectName ?? "Repository"}
        sections={view.sections}
        activePageId={view.activePage?.id ?? activeWikiPageId}
        onSelectPage={selectWikiPage}
      />
      <WikiPageView page={view.activePage} />
      <WikiEvidenceRail
        page={view.activePage}
        evidence={view.evidence}
        graphNodeIds={view.graphNodeIds}
        onOpenGraph={openGraphForWikiPage}
      />
    </div>
  );
}
