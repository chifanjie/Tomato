import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  searchWiki,
  type WikiSearchGroupKind,
  type WikiSearchRuntime,
} from "../../wiki/searchIndex";
import { wikiTargetHash, type WikiTarget } from "../../wiki/wikiContent";
import type { SearchLoadStatus } from "../../wiki/wikiArtifacts";

export interface GlobalWikiSearchProps {
  open: boolean;
  loadStatus: SearchLoadStatus;
  runtime: WikiSearchRuntime;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectTarget: (target: WikiTarget) => void;
}

export interface GlobalWikiSearchItem {
  record: WikiSearchRecordV2;
  target: WikiTarget;
  href: string;
  relationLabel: string;
}

export interface GlobalWikiSearchGroupView {
  kind: WikiSearchGroupKind;
  label: string;
  total: number;
  items: GlobalWikiSearchItem[];
}

export interface GlobalWikiSearchView {
  groups: GlobalWikiSearchGroupView[];
  total: number;
  hasNextPage: boolean;
}

const GROUPS: ReadonlyArray<{ kind: WikiSearchGroupKind; label: string }> = [
  { kind: "direct", label: "最佳结果" },
  { kind: "capability-flow", label: "能力与流程" },
  { kind: "module-file", label: "模块与文件" },
  { kind: "symbol", label: "函数与类型" },
  { kind: "context", label: "相关资料" },
];

const SEARCH_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function searchFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(SEARCH_FOCUSABLE_SELECTOR)].filter((element) =>
    !element.hasAttribute("hidden")
    && element.getAttribute("aria-hidden") !== "true");
}

export function searchRelationLabel(
  record: Pick<WikiSearchRecordV2, "relation" | "kind">,
): string {
  if (record.relation === "none") return "按内容匹配";
  if (record.relation === "context") return "上下文资料";
  return record.kind === "symbol" ? "代码符号" : "直接文档";
}

export function buildGlobalWikiSearchView(
  runtime: WikiSearchRuntime,
  query: string,
  visibleCount: number,
): GlobalWikiSearchView {
  const results = searchWiki(runtime, query, 1, visibleCount);
  const resultGroups = new Map(results.groups.map((group) => [group.kind, group.items]));
  return {
    groups: GROUPS.map(({ kind, label }) => ({
      kind,
      label,
      total: results.totalByKind[kind],
      items: (resultGroups.get(kind) ?? []).map((record) => {
        const target: WikiTarget = {
          pageId: record.pageId,
          ...(record.anchor ? { anchor: record.anchor } : {}),
        };
        return {
          record,
          target,
          href: wikiTargetHash(target),
          relationLabel: searchRelationLabel(record),
        };
      }),
    })),
    total: results.total,
    hasNextPage: results.hasNextPage,
  };
}

export function globalWikiSearchStatusMessage(
  loadStatus: SearchLoadStatus,
  query: string,
  total: number,
): string | null {
  if (loadStatus === "loading") return "正在加载全局搜索索引…";
  if (!query.trim()) return "输入文档、流程、文件或函数名称开始搜索。";
  if (total === 0) return "没有找到匹配内容，请尝试其他关键词。";
  return null;
}

export default function GlobalWikiSearch({
  open,
  loadStatus,
  runtime,
  returnFocusRef,
  onClose,
  onSelectTarget,
}: GlobalWikiSearchProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const deferredQuery = useDeferredValue(query);
  const previousOpen = useRef(open);
  const previousLoadStatus = useRef(loadStatus);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const activationFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const containmentFrameRef = useRef<number | null>(null);
  const readyFocusFrameRef = useRef<number | null>(null);
  onCloseRef.current = onClose;
  const view = useMemo(
    () => buildGlobalWikiSearchView(runtime, deferredQuery, visibleCount),
    [deferredQuery, runtime, visibleCount],
  );
  const statusMessage = globalWikiSearchStatusMessage(loadStatus, deferredQuery, view.total);

  useEffect(() => {
    setVisibleCount(20);
  }, [query]);

  useEffect(() => {
    if (previousOpen.current && !open) returnFocusRef.current?.focus();
    previousOpen.current = open;
  }, [open, returnFocusRef]);

  useLayoutEffect(() => {
    const wasLoading = previousLoadStatus.current === "loading";
    previousLoadStatus.current = loadStatus;
    if (
      !open
      || !wasLoading
      || (loadStatus !== "ready" && loadStatus !== "fallback")
    ) return;

    readyFocusFrameRef.current = window.requestAnimationFrame(() => {
      readyFocusFrameRef.current = null;
      const dialog = dialogRef.current;
      const input = inputRef.current;
      const active = document.activeElement;
      if (
        dialog
        && input
        && !input.disabled
        && (active === dialog || active === closeButtonRef.current)
      ) input.focus();
    });
    return () => {
      if (readyFocusFrameRef.current === null) return;
      window.cancelAnimationFrame(readyFocusFrameRef.current);
      readyFocusFrameRef.current = null;
    };
  }, [loadStatus, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const cancelFrame = (frameRef: { current: number | null }) => {
      if (frameRef.current === null) return;
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    const focusInside = () => {
      if (dialog.contains(document.activeElement)) return;
      const input = inputRef.current;
      const focusTarget = input && !input.disabled
        ? input
        : (searchFocusableElements(dialog)[0] ?? dialog);
      focusTarget.focus();
    };
    const scheduleContainment = () => {
      cancelFrame(activationFrameRef);
      cancelFrame(focusFrameRef);
      cancelFrame(containmentFrameRef);
      containmentFrameRef.current = window.requestAnimationFrame(() => {
        containmentFrameRef.current = null;
        focusInside();
      });
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (event.target instanceof Node && dialog.contains(event.target)) {
        scheduleContainment();
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && dialog.contains(event.target)) {
        cancelFrame(containmentFrameRef);
        return;
      }
      scheduleContainment();
    };
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("focusin", handleFocusIn);
    focusInside();
    activationFrameRef.current = window.requestAnimationFrame(() => {
      activationFrameRef.current = null;
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        focusInside();
      });
    });
    return () => {
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("focusin", handleFocusIn);
      cancelFrame(activationFrameRef);
      cancelFrame(focusFrameRef);
      cancelFrame(containmentFrameRef);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = searchFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="uc-global-search-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索知识库"
        tabIndex={-1}
        className="uc-global-search-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="uc-global-search-header">
          <label htmlFor="global-wiki-search-input">全局搜索</label>
          <input
            id="global-wiki-search-input"
            ref={inputRef}
            value={query}
            disabled={loadStatus === "loading"}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文档、流程、文件或函数…"
            className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
          />
          <kbd className="uc-global-search-hint rounded border border-border-subtle bg-elevated px-2 py-1 text-text-muted">Esc</kbd>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭搜索" className="rounded p-1.5 text-text-muted hover:bg-elevated hover:text-text-primary">关闭</button>
        </header>

        {loadStatus === "fallback" && (
          <p className="uc-global-search-fallback">
            搜索索引不可用，当前仅搜索标题、路径和符号。
          </p>
        )}

        <div className="uc-global-search-results">
          {statusMessage && view.total === 0 ? (
            <p role="status" className="py-10 text-center text-sm text-text-muted">{statusMessage}</p>
          ) : view.total > 0 ? (
            <div className="space-y-6">
              {view.groups.map((group) => (
                <section key={group.kind} aria-label={group.label}>
                  <h2 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-text-muted">
                    <span>{group.label}</span>
                    <span>{group.total}</span>
                  </h2>
                  {group.items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border-subtle px-3 py-2 text-xs text-text-muted">本组暂无匹配</p>
                  ) : (
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.record.id}>
                          <a
                            href={item.href}
                            onClick={(event) => {
                              event.preventDefault();
                              onSelectTarget(item.target);
                            }}
                            className="block px-3 py-2.5 transition-colors hover:bg-elevated focus-visible:bg-elevated"
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-text-primary">{item.record.title}</span>
                                {(item.record.summary || item.record.filePath) && (
                                  <span className="uc-global-search-metadata mt-1 block line-clamp-2 leading-5 text-text-muted">
                                    {item.record.summary ?? item.record.filePath}
                                  </span>
                                )}
                              </span>
                              <span className="uc-global-search-relation shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-text-muted">
                                {item.relationLabel}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
              {view.hasNextPage && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 20)}
                  className="uc-global-search-more w-full rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                >
                  继续显示
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
