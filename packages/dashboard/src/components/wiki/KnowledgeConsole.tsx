import { useRef, useState } from "react";
import { useDashboardStore } from "../../store";
import { wikiPageHash, type WikiTarget } from "../../wiki/wikiContent";
import { buildKnowledgeConsoleView } from "./knowledgeConsoleModel";
import GuidedWikiHome from "./GuidedWikiHome";
import KnowledgeStatusView from "./KnowledgeStatusView";
import WikiEvidenceRail from "./WikiEvidenceRail";
import { useEvidenceExcerpts } from "../../wiki/ExcerptContext";
import WikiNavigation from "./WikiNavigation";
import WikiPageView, { type WikiOutlineHeading } from "./WikiPageView";
import WikiResponsiveShell from "./WikiResponsiveShell";

export interface KnowledgeConsoleProps {
  onSelectWikiPage?: (pageId: string | null) => void;
  onSelectWikiTarget?: (target: WikiTarget) => void;
  onOpenGraphHome?: () => void;
  onOpenGraphForPage?: (pageId: string) => void;
  externalModalOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  wikiNavigationRevision?: number;
}

export default function KnowledgeConsole({
  onSelectWikiPage,
  onSelectWikiTarget,
  onOpenGraphHome,
  onOpenGraphForPage,
  externalModalOpen = false,
  onDrawerOpenChange,
  wikiNavigationRevision = 0,
}: KnowledgeConsoleProps = {}) {
  const wikiIndex = useDashboardStore((state) => state.wikiIndex);
  const activeWikiPageId = useDashboardStore((state) => state.activeWikiPageId);
  const selectWikiPage = useDashboardStore((state) => state.selectWikiPage);
  const setDashboardSurface = useDashboardStore((state) => state.setDashboardSurface);
  const openGraphForWikiPage = useDashboardStore((state) => state.openGraphForWikiPage);
  const view = buildKnowledgeConsoleView(wikiIndex, activeWikiPageId);
  // Only the open page's evidence is requested, so a page view costs the same
  // on a large repository as on a small one.
  const pageExcerpts = useEvidenceExcerpts(view.exactEvidence.map((item) => item.id));
  const [outlineHeadings, setOutlineHeadings] = useState<WikiOutlineHeading[]>([]);
  const [activeAuxView, setActiveAuxView] = useState<"home" | "status" | null>("home");
  const visibleAuxView = view.activePage ? null : activeAuxView ?? "home";
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const referenceTriggerRef = useRef<HTMLButtonElement>(null);
  const referenceRequestReturnFocusRef = useRef<HTMLButtonElement>(null);
  const [navigationRequestKey, setNavigationRequestKey] = useState(0);
  const activeReferencePage = view.activePage?.role === "reference"
    && view.activePage.category === "file";
  const visibleReferenceExpanded = referenceExpanded || activeReferencePage;

  const navigateWikiPage = (pageId: string | null) => {
    if (onSelectWikiPage) {
      onSelectWikiPage(pageId);
      return;
    }
    selectWikiPage(pageId);
    if (typeof window === "undefined") return;
    const nextUrl = pageId
      ? `${window.location.pathname}${window.location.search}${wikiPageHash(pageId)}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", nextUrl);
  };

  const openPage = (pageId: string) => {
    setActiveAuxView(null);
    navigateWikiPage(pageId);
  };
  const openHome = () => {
    setActiveAuxView("home");
    navigateWikiPage(null);
  };
  const openStatus = () => {
    setActiveAuxView("status");
    navigateWikiPage(null);
  };
  const openReference = (opener: HTMLButtonElement) => {
    referenceRequestReturnFocusRef.current = opener;
    setReferenceExpanded(true);
    setNavigationRequestKey((key) => key + 1);
  };
  const openGraphHome = () => {
    if (onOpenGraphHome) {
      onOpenGraphHome();
      return;
    }
    setDashboardSurface("graph");
    if (typeof window !== "undefined") {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#graph`,
      );
    }
  };
  const openGraphForPage = (pageId: string) => {
    if (onOpenGraphForPage) {
      onOpenGraphForPage(pageId);
      return;
    }
    openGraphForWikiPage(pageId);
    if (typeof window !== "undefined") {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#graph`,
      );
    }
  };

  const navigation = (
    <WikiNavigation
      model={view.navigation}
      activePageId={view.activePage?.id ?? activeWikiPageId}
      activeAuxView={visibleAuxView}
      referenceExpanded={visibleReferenceExpanded}
      referenceTriggerRef={referenceTriggerRef}
      onReferenceExpandedChange={setReferenceExpanded}
      onSelectHome={openHome}
      onSelectStatus={openStatus}
      onSelectPage={openPage}
    />
  );

  const article = view.activePage ? (
    <WikiPageView
      page={view.activePage}
      pages={wikiIndex.pages}
      onSelectTarget={onSelectWikiTarget}
      onHeadingsChange={setOutlineHeadings}
      navigationRevision={wikiNavigationRevision}
    />
  ) : visibleAuxView === "status" ? (
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
  );

  const evidence = view.activePage ? (
    <WikiEvidenceRail
      page={view.activePage}
      directPages={view.directPages}
      contextPages={view.contextPages}
      evidence={view.exactEvidence}
      directGraphNodeIds={view.directGraphNodeIds}
      headings={outlineHeadings}
      onOpenPage={openPage}
      onOpenGraph={openGraphForPage}
      excerpts={pageExcerpts.excerpts}
      excerptsLoading={pageExcerpts.loading}
    />
  ) : undefined;

  return (
    <WikiResponsiveShell
      navigation={navigation}
      article={article}
      evidence={evidence}
      externalModalOpen={externalModalOpen}
      onDrawerOpenChange={onDrawerOpenChange}
      navigationRequestKey={navigationRequestKey}
      navigationRequestReturnFocusRef={referenceRequestReturnFocusRef}
      navigationRequestInitialFocusRef={referenceTriggerRef}
    />
  );
}
