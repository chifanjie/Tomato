import { useState, type RefObject } from "react";
import {
  visibleReferenceRows,
  type ReferenceTreeNode,
  type WikiNavigationModel,
} from "../../wiki/navigationModel";

interface WikiNavigationProps {
  model: WikiNavigationModel;
  activePageId: string | null;
  referenceExpanded: boolean;
  referenceTriggerRef: RefObject<HTMLButtonElement | null>;
  onReferenceExpandedChange: (expanded: boolean) => void;
  onSelectHome: () => void;
  onSelectStatus: () => void;
  onSelectPage: (pageId: string) => void;
}

function pageButtonClass(active: boolean): string {
  return `my-0.5 block w-full rounded-md px-2.5 py-2 text-left text-[13px] leading-5 transition-colors ${
    active
      ? "bg-accent/10 font-medium text-text-primary"
      : "text-text-secondary hover:bg-elevated hover:text-text-primary"
  }`;
}

function branchLabel(node: ReferenceTreeNode): string {
  return node.kind === "module" ? node.path || node.label : node.label;
}

export default function WikiNavigation({
  model,
  activePageId,
  referenceExpanded,
  referenceTriggerRef,
  onReferenceExpandedChange,
  onSelectHome,
  onSelectStatus,
  onSelectPage,
}: WikiNavigationProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const visibleRows = referenceExpanded
    ? visibleReferenceRows(model, expandedNodeIds)
    : [];

  const toggleReferenceNode = (nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <nav
      aria-label="知识库目录"
      className="flex h-full w-[292px] shrink-0 flex-col border-r border-border-subtle bg-surface max-xl:w-[252px] max-lg:h-[44vh] max-lg:min-h-[300px] max-lg:w-full max-lg:border-b max-lg:border-r-0"
    >
      <div className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-text-muted">
          项目知识库
        </p>
        <button
          type="button"
          onClick={onSelectHome}
          aria-current={!activePageId ? "page" : undefined}
          className={`mt-3 w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
            !activePageId
              ? "bg-accent/10 font-medium text-text-primary"
              : "text-text-secondary hover:bg-elevated hover:text-text-primary"
          }`}
        >
          阅读首页
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <div className="space-y-3">
          <section className="rounded-lg border border-border-subtle/70 bg-root/20">
            <div
              aria-expanded="true"
              className="flex items-center gap-2 px-3 py-3 text-left"
            >
              <span aria-hidden="true" className="rotate-90 text-xs text-text-muted">
                ›
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text-primary">主干阅读</span>
                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                  按推荐顺序理解项目
                </span>
              </span>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] tabular-nums text-text-muted">
                {model.featured.pages.length}
              </span>
            </div>
            <div className="border-t border-border-subtle/70 px-2 py-2">
              {model.featured.pages.length === 0 ? (
                <p className="px-2.5 py-2 text-xs leading-5 text-text-muted">
                  暂无可发布的主干文档。
                </p>
              ) : model.featured.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onSelectPage(page.id)}
                  aria-current={activePageId === page.id ? "page" : undefined}
                  className={pageButtonClass(activePageId === page.id)}
                >
                  <span className="block line-clamp-2">{page.title}</span>
                  {activePageId === page.id && page.summary && (
                    <span className="mt-1 block line-clamp-2 text-[11px] font-normal leading-4 text-text-muted">
                      {page.summary}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle/70 bg-root/20">
            <button
              ref={referenceTriggerRef}
              type="button"
              onClick={() => onReferenceExpandedChange(!referenceExpanded)}
              aria-expanded={referenceExpanded}
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
            >
              <span
                aria-hidden="true"
                className={`text-xs text-text-muted transition-transform ${referenceExpanded ? "rotate-90" : ""}`}
              >
                ›
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text-primary">代码参考</span>
                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                  按目录查找文件文档
                </span>
              </span>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] tabular-nums text-text-muted">
                {model.reference.totalFiles}
              </span>
            </button>

            {referenceExpanded && (
              <div className="border-t border-border-subtle/70 px-2 py-2">
                {visibleRows.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs leading-5 text-text-muted">
                    暂无可浏览的文件参考。
                  </p>
                ) : visibleRows.map(({ node, depth }) => {
                  const active = node.pageId === activePageId;
                  if (node.kind === "file") {
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => node.pageId && onSelectPage(node.pageId)}
                        aria-current={active ? "page" : undefined}
                        title={node.path}
                        className={pageButtonClass(active)}
                        style={{ paddingLeft: `${depth * 14 + 24}px` }}
                      >
                        <span className="block truncate">{node.label}</span>
                      </button>
                    );
                  }
                  const expanded = expandedNodeIds.has(node.id);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => toggleReferenceNode(node.id)}
                      aria-expanded={expanded}
                      title={node.path || node.label}
                      className="flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                      style={{ paddingLeft: `${depth * 14 + 10}px` }}
                    >
                      <span
                        aria-hidden="true"
                        className={`text-[10px] text-text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                      <span className="min-w-0 flex-1 truncate">{branchLabel(node)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border-subtle/70 bg-root/20">
            <button
              type="button"
              onClick={onSelectStatus}
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
            >
              <span aria-hidden="true" className="text-xs text-text-muted">·</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text-primary">知识库状态</span>
                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                  查看覆盖缺口与生成质量
                </span>
              </span>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] tabular-nums text-text-muted">
                {model.maintenance.pages.length + model.reference.orphanPageIds.length}
              </span>
            </button>
          </section>
        </div>
      </div>
    </nav>
  );
}
