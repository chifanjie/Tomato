import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import {
  useDeferredValue,
  useEffect,
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

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索知识库"
        className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-medium bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
          <span aria-hidden="true" className="text-lg text-text-muted">⌕</span>
          <input
            autoFocus
            value={query}
            disabled={loadStatus === "loading"}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文档、流程、文件或函数…"
            className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
          />
          <kbd className="rounded border border-border-subtle bg-elevated px-2 py-1 text-[11px] text-text-muted">Esc</kbd>
          <button type="button" onClick={onClose} aria-label="关闭搜索" className="rounded p-1.5 text-text-muted hover:bg-elevated hover:text-text-primary">×</button>
        </header>

        {loadStatus === "fallback" && (
          <p className="border-b border-amber-400/25 bg-amber-500/5 px-5 py-3 text-sm text-text-secondary">
            搜索索引不可用，当前仅搜索标题、路径和符号。
          </p>
        )}

        <div className="overflow-y-auto px-5 py-4">
          {statusMessage ? (
            <p role="status" className="py-10 text-center text-sm text-text-muted">{statusMessage}</p>
          ) : (
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
                    <ul className="space-y-1.5">
                      {group.items.map((item) => (
                        <li key={item.record.id}>
                          <a
                            href={item.href}
                            onClick={(event) => {
                              event.preventDefault();
                              onSelectTarget(item.target);
                            }}
                            className="block rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border-subtle hover:bg-elevated"
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-text-primary">{item.record.title}</span>
                                {(item.record.summary || item.record.filePath) && (
                                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-text-muted">
                                    {item.record.summary ?? item.record.filePath}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted">
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
                  className="w-full rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                >
                  继续显示
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
