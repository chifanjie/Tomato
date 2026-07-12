import { useRef, useState } from "react";
import { useDashboardStore } from "../../store";
import { wikiPageHash } from "../../wiki/wikiContent";
import { buildKnowledgeConsoleView } from "./knowledgeConsoleModel";
import GuidedWikiHome from "./GuidedWikiHome";
import KnowledgeStatusView from "./KnowledgeStatusView";
import WikiEvidenceRail from "./WikiEvidenceRail";
import WikiNavigation from "./WikiNavigation";
import WikiPageView, { type WikiOutlineHeading } from "./WikiPageView";

export default function KnowledgeConsole() {
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const activeWikiPageId = useDashboardStore((state) => state.activeWikiPageId);
  const selectWikiPage = useDashboardStore((state) => state.selectWikiPage);
  const setDashboardSurface = useDashboardStore((state) => state.setDashboardSurface);
  const openGraphForWikiPage = useDashboardStore((state) => state.openGraphForWikiPage);
  const view = buildKnowledgeConsoleView(wikiIndex, activeWikiPageId);
  const [outlineHeadings, setOutlineHeadings] = useState<WikiOutlineHeading[]>([]);
  const [auxView, setAuxView] = useState<"home" | "status">("home");
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const referenceTriggerRef = useRef<HTMLButtonElement>(null);

  const navigateWikiPage = (pageId: string | null) => {
    selectWikiPage(pageId);
    if (typeof window === "undefined") return;
    const nextUrl = pageId
      ? `${window.location.pathname}${window.location.search}${wikiPageHash(pageId)}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", nextUrl);
  };

  const openPage = (pageId: string) => {
    setAuxView("home");
    navigateWikiPage(pageId);
  };
  const openHome = () => {
    setAuxView("home");
    navigateWikiPage(null);
  };
  const openStatus = () => {
    setAuxView("status");
    navigateWikiPage(null);
  };
  const openReference = () => {
    setReferenceExpanded(true);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => referenceTriggerRef.current?.focus());
    } else {
      referenceTriggerRef.current?.focus();
    }
  };
  const openGraphHome = () => {
    setDashboardSurface("graph");
    if (typeof window !== "undefined") {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#graph`,
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-root text-text-primary max-lg:flex-col max-lg:overflow-auto">
      <WikiNavigation
        model={view.navigation}
        activePageId={view.activePage?.id ?? activeWikiPageId}
        referenceExpanded={referenceExpanded}
        referenceTriggerRef={referenceTriggerRef}
        onReferenceExpandedChange={setReferenceExpanded}
        onSelectHome={openHome}
        onSelectStatus={openStatus}
        onSelectPage={openPage}
      />
      {view.activePage ? (
        <WikiPageView
          page={view.activePage}
          pages={wikiIndex.pages}
          onHeadingsChange={setOutlineHeadings}
        />
      ) : auxView === "status" ? (
        <KnowledgeStatusView
          index={wikiIndex}
          orphanReferencePageIds={view.navigation.reference.orphanPageIds}
        />
      ) : (
        <GuidedWikiHome
          projectName={wikiIndex.payload?.projectName ?? "代码仓库"}
          routePages={wikiIndex.routePages}
          onOpenPage={openPage}
          onOpenGraph={openGraphHome}
          onOpenReference={openReference}
        />
      )}
      {view.activePage && (
        <WikiEvidenceRail
          page={view.activePage}
          directPages={view.directPages}
          contextPages={view.contextPages}
          evidence={view.exactEvidence}
          directGraphNodeIds={view.directGraphNodeIds}
          headings={outlineHeadings}
          onOpenPage={openPage}
          onOpenGraph={openGraphForWikiPage}
        />
      )}
    </div>
  );
}
