import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { useIsMobile } from "../../hooks/useIsMobile";

export type WikiDrawerState = "closed" | "navigation" | "evidence";

export type WikiDrawerAction = {
  type: "open-navigation" | "open-evidence" | "close" | "escape";
};

export function reduceDrawerState(
  _state: WikiDrawerState,
  action: WikiDrawerAction,
): WikiDrawerState {
  if (action.type === "open-navigation") return "navigation";
  if (action.type === "open-evidence") return "evidence";
  return "closed";
}

export interface WikiResponsiveShellProps {
  navigation: ReactNode;
  article: ReactNode;
  evidence?: ReactNode;
  externalModalOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  navigationRequestKey?: number;
  navigationRequestReturnFocusRef?: RefObject<HTMLButtonElement | null>;
  navigationRequestInitialFocusRef?: RefObject<HTMLElement | null>;
}

const NARROW_WIKI_QUERY = "(max-width: 1023px)";
export const GLOBAL_WIKI_SEARCH_REQUEST_EVENT =
  "understand-code:request-global-wiki-search";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function useNarrowWikiLayout(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_WIKI_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_WIKI_QUERY);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return narrow;
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
  const layoutAvailable = panel.getClientRects().length > 0;
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.getAttribute("tabindex") === "-1") return false;
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      if (
        current.hasAttribute("hidden")
        || current.hasAttribute("inert")
        || current.getAttribute("aria-hidden") === "true"
      ) return false;
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (current === panel) break;
    }
    return !layoutAvailable || element.getClientRects().length > 0;
  });
}

export default function WikiResponsiveShell({
  navigation,
  article,
  evidence,
  externalModalOpen = false,
  onDrawerOpenChange,
  navigationRequestKey = 0,
  navigationRequestReturnFocusRef,
  navigationRequestInitialFocusRef,
}: WikiResponsiveShellProps) {
  const narrow = useNarrowWikiLayout();
  const phone = useIsMobile(768);
  const [drawer, dispatch] = useReducer(reduceDrawerState, "closed");
  const [desktopEvidenceExpanded, setDesktopEvidenceExpanded] = useState(true);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopEvidenceCollapseRef = useRef<HTMLButtonElement>(null);
  const desktopEvidenceExpandRef = useRef<HTMLButtonElement>(null);
  const navigationDrawerRef = useRef<HTMLDivElement>(null);
  const evidenceDrawerRef = useRef<HTMLDivElement>(null);
  const drawerFocusFrameRef = useRef<number | null>(null);
  const navigationRequestFrameRef = useRef<number | null>(null);
  const requestedNavigationInitialFocusRef = useRef<HTMLElement | null>(null);
  const lastNavigationRequestKeyRef = useRef(navigationRequestKey);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const hasEvidence = evidence !== undefined && evidence !== null;
  const navigationOpen = !externalModalOpen && narrow && drawer === "navigation";
  const evidenceOpen = !externalModalOpen && narrow && drawer === "evidence" && hasEvidence;
  const anyDrawerOpen = navigationOpen || evidenceOpen;
  const navigationInert = externalModalOpen || (narrow && !navigationOpen);
  const evidenceInert = externalModalOpen || (narrow && !evidenceOpen);
  const articleInert = externalModalOpen || anyDrawerOpen;

  const openNavigation = () => {
    requestedNavigationInitialFocusRef.current = null;
    returnFocusRef.current = navigationTriggerRef.current;
    dispatch({ type: "open-navigation" });
  };
  const openEvidence = () => {
    requestedNavigationInitialFocusRef.current = null;
    returnFocusRef.current = evidenceTriggerRef.current;
    dispatch({ type: "open-evidence" });
  };
  const collapseDesktopEvidence = () => {
    setDesktopEvidenceExpanded(false);
    queueMicrotask(() => desktopEvidenceExpandRef.current?.focus());
  };
  const expandDesktopEvidence = () => {
    setDesktopEvidenceExpanded(true);
    queueMicrotask(() => desktopEvidenceCollapseRef.current?.focus());
  };
  const closeDrawer = useCallback((type: "close" | "escape") => {
    const returnTarget = returnFocusRef.current;
    requestedNavigationInitialFocusRef.current = null;
    dispatch({ type });
    queueMicrotask(() => returnTarget?.focus());
  }, []);

  useEffect(() => {
    const yieldToGlobalSearch = () => {
      returnFocusRef.current = null;
      requestedNavigationInitialFocusRef.current = null;
      dispatch({ type: "close" });
    };
    window.addEventListener(GLOBAL_WIKI_SEARCH_REQUEST_EVENT, yieldToGlobalSearch);
    return () => window.removeEventListener(
      GLOBAL_WIKI_SEARCH_REQUEST_EVENT,
      yieldToGlobalSearch,
    );
  }, []);

  useEffect(() => {
    if (!externalModalOpen || drawer === "closed") return;
    returnFocusRef.current = null;
    dispatch({ type: "close" });
  }, [drawer, externalModalOpen]);

  useEffect(() => {
    onDrawerOpenChange?.(anyDrawerOpen);
    return () => {
      if (anyDrawerOpen) onDrawerOpenChange?.(false);
    };
  }, [anyDrawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    if (navigationRequestKey === lastNavigationRequestKeyRef.current) return;
    lastNavigationRequestKeyRef.current = navigationRequestKey;
    if (externalModalOpen) return;
    const initialFocus = navigationRequestInitialFocusRef?.current ?? null;
    returnFocusRef.current = navigationRequestReturnFocusRef?.current
      ?? navigationTriggerRef.current;
    if (narrow) {
      requestedNavigationInitialFocusRef.current = initialFocus;
      dispatch({ type: "open-navigation" });
      return;
    }
    if (!initialFocus) return;
    const frame = window.requestAnimationFrame(() => {
      navigationRequestFrameRef.current = window.requestAnimationFrame(() => {
        initialFocus.focus();
        initialFocus.scrollIntoView?.({ block: "nearest" });
      });
    });
    navigationRequestFrameRef.current = frame;
    return () => {
      if (navigationRequestFrameRef.current !== null) {
        window.cancelAnimationFrame(navigationRequestFrameRef.current);
        navigationRequestFrameRef.current = null;
      }
    };
  }, [
    externalModalOpen,
    narrow,
    navigationRequestInitialFocusRef,
    navigationRequestKey,
    navigationRequestReturnFocusRef,
  ]);

  useEffect(() => {
    if (narrow || drawer === "closed") return;
    const survivingPanel = drawer === "navigation"
      ? navigationDrawerRef.current
      : evidenceDrawerRef.current;
    const fallback = drawer === "evidence" && !desktopEvidenceExpanded
      ? desktopEvidenceExpandRef.current
      : null;
    returnFocusRef.current = null;
    dispatch({ type: "close" });
    queueMicrotask(() => (survivingPanel ?? fallback)?.focus());
  }, [desktopEvidenceExpanded, drawer, narrow]);

  useEffect(() => {
    if (hasEvidence || drawer !== "evidence") return;
    dispatch({ type: "close" });
    queueMicrotask(() => navigationTriggerRef.current?.focus());
  }, [drawer, hasEvidence]);

  useEffect(() => {
    if (externalModalOpen || !narrow || drawer === "closed") return;
    const panel = drawer === "navigation"
      ? navigationDrawerRef.current
      : evidenceDrawerRef.current;
    if (!panel) return;
    const frame = window.requestAnimationFrame(() => {
      drawerFocusFrameRef.current = window.requestAnimationFrame(() => {
        const requestedFocus = drawer === "navigation"
          ? requestedNavigationInitialFocusRef.current
          : null;
        const firstFocusable = focusableElements(panel)[0];
        const focusTarget = requestedFocus && panel.contains(requestedFocus)
          ? requestedFocus
          : (firstFocusable ?? panel);
        focusTarget.focus();
        if (requestedFocus === focusTarget) {
          focusTarget.scrollIntoView?.({ block: "nearest" });
        }
        requestedNavigationInitialFocusRef.current = null;
      });
    });
    drawerFocusFrameRef.current = frame;
    return () => {
      if (drawerFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(drawerFocusFrameRef.current);
        drawerFocusFrameRef.current = null;
      }
    };
  }, [drawer, externalModalOpen, narrow]);

  useEffect(() => {
    if (externalModalOpen || !narrow || drawer === "closed") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer("escape");
        return;
      }
      if (event.key !== "Tab") return;

      const panel = drawer === "navigation"
        ? navigationDrawerRef.current
        : evidenceDrawerRef.current;
      if (!panel) return;
      const focusable = focusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, drawer, externalModalOpen, narrow]);

  return (
    <div
      className="uc-wiki-shell"
      data-drawer={drawer}
      data-has-evidence={hasEvidence ? "true" : "false"}
      data-desktop-evidence={desktopEvidenceExpanded ? "expanded" : "collapsed"}
    >
      <div
        className="uc-wiki-toolbar"
        hidden={!narrow}
        aria-hidden={!narrow || externalModalOpen ? true : undefined}
        inert={externalModalOpen ? true : undefined}
      >
        <button
          ref={navigationTriggerRef}
          type="button"
          aria-label="打开知识目录"
          aria-controls="wiki-navigation-drawer"
          aria-expanded={navigationOpen}
          onClick={openNavigation}
        >
          知识目录
        </button>
        {hasEvidence && (
          <button
            ref={evidenceTriggerRef}
            type="button"
            aria-label="打开源码证据"
            aria-controls="wiki-evidence-drawer"
            aria-expanded={evidenceOpen}
            onClick={openEvidence}
          >
            源码证据
          </button>
        )}
      </div>

      <div
        ref={navigationDrawerRef}
        id="wiki-navigation-drawer"
        className="uc-wiki-navigation"
        data-open={navigationOpen ? "true" : "false"}
        data-presentation={narrow ? (phone ? "sheet" : "drawer") : "rail"}
        role={navigationOpen ? "dialog" : undefined}
        aria-modal={navigationOpen ? true : undefined}
        aria-label={navigationOpen ? "知识目录" : undefined}
        aria-hidden={navigationInert ? true : undefined}
        inert={navigationInert ? true : undefined}
        tabIndex={-1}
      >
        {narrow && (
          <button
            type="button"
            aria-label="关闭知识目录"
            className="uc-wiki-drawer-close"
            onClick={() => closeDrawer("close")}
          >
            关闭知识目录
          </button>
        )}
        {navigation}
      </div>

      <div
        className="uc-wiki-article"
        aria-hidden={articleInert ? true : undefined}
        inert={articleInert ? true : undefined}
      >
        {article}
        {hasEvidence && !narrow && !desktopEvidenceExpanded && (
          <button
            ref={desktopEvidenceExpandRef}
            type="button"
            aria-label="展开源码证据"
            className="uc-wiki-desktop-evidence-toggle uc-wiki-desktop-evidence-expand"
            onClick={expandDesktopEvidence}
          >
            展开源码证据
          </button>
        )}
      </div>

      {hasEvidence && (narrow || desktopEvidenceExpanded) && (
        <div
          ref={evidenceDrawerRef}
          id="wiki-evidence-drawer"
          className="uc-wiki-evidence"
          data-open={evidenceOpen ? "true" : "false"}
          data-presentation={narrow ? (phone ? "sheet" : "drawer") : "rail"}
          role={evidenceOpen ? "dialog" : undefined}
          aria-modal={evidenceOpen ? true : undefined}
          aria-label={evidenceOpen ? "源码证据" : undefined}
          aria-hidden={evidenceInert ? true : undefined}
          inert={evidenceInert ? true : undefined}
          tabIndex={-1}
        >
          {!narrow && (
            <button
              ref={desktopEvidenceCollapseRef}
              type="button"
              aria-label="收起源码证据"
              className="uc-wiki-desktop-evidence-toggle uc-wiki-desktop-evidence-collapse"
              onClick={collapseDesktopEvidence}
            >
              收起源码证据
            </button>
          )}
          {narrow && (
            <button
              type="button"
              aria-label="关闭源码证据"
              className="uc-wiki-drawer-close"
              onClick={() => closeDrawer("close")}
            >
              关闭源码证据
            </button>
          )}
          {evidence}
        </div>
      )}

      {anyDrawerOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="关闭抽屉遮罩"
          className="uc-wiki-backdrop"
          onClick={() => closeDrawer("close")}
        />
      )}
    </div>
  );
}
