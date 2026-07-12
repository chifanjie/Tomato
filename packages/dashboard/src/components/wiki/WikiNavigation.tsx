import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  visibleReferenceRows,
  type ReferenceTreeNode,
  type WikiNavigationModel,
} from "../../wiki/navigationModel";

interface WikiNavigationProps {
  model: WikiNavigationModel;
  activePageId: string | null;
  activeAuxView: "home" | "status" | null;
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

function requiredReferenceBranchIds(
  model: WikiNavigationModel,
  activePageId: string | null,
): ReadonlySet<string> {
  if (!activePageId) return new Set();
  const target = [...model.reference.nodesById.values()]
    .find((node) => node.kind === "file" && node.pageId === activePageId);
  if (!target) return new Set();

  const parentByChildId = new Map<string, string>();
  for (const node of model.reference.nodesById.values()) {
    for (const childId of node.childIds) parentByChildId.set(childId, node.id);
  }
  const required = new Set<string>();
  const visited = new Set<string>([target.id]);
  let currentId = target.id;
  while (parentByChildId.has(currentId)) {
    const parentId = parentByChildId.get(currentId)!;
    if (visited.has(parentId)) break;
    visited.add(parentId);
    required.add(parentId);
    currentId = parentId;
  }
  return required;
}

export default function WikiNavigation({
  model,
  activePageId,
  activeAuxView,
  referenceExpanded,
  referenceTriggerRef,
  onReferenceExpandedChange,
  onSelectHome,
  onSelectStatus,
  onSelectPage,
}: WikiNavigationProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const activeReferenceButtonRef = useRef<HTMLButtonElement>(null);
  const requiredExpandedNodeIds = useMemo(
    () => requiredReferenceBranchIds(model, activePageId),
    [activePageId, model],
  );
  const visibleExpandedNodeIds = useMemo(
    () => new Set([...expandedNodeIds, ...requiredExpandedNodeIds]),
    [expandedNodeIds, requiredExpandedNodeIds],
  );
  const visibleRows = referenceExpanded
    ? visibleReferenceRows(model, visibleExpandedNodeIds)
    : [];
  const homeActive = activeAuxView === "home";
  const statusActive = activeAuxView === "status";

  useEffect(() => {
    if (!referenceExpanded || requiredExpandedNodeIds.size === 0) return;
    const frame = requestAnimationFrame(() => {
      activeReferenceButtonRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePageId, referenceExpanded, requiredExpandedNodeIds]);

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
      className="flex h-full min-h-0 flex-col bg-surface"
    >
      <div className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-text-muted">
          项目知识库
        </p>
        <button
          type="button"
          onClick={onSelectHome}
          aria-current={homeActive ? "page" : undefined}
          className={`mt-3 w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
            homeActive
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
            <header className="flex items-center gap-2 px-3 py-3 text-left">
              <span className="min-w-0 flex-1">
                <h2 className="text-xs font-semibold text-text-primary">主干阅读</h2>
                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                  按推荐顺序理解项目
                </span>
              </span>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] tabular-nums text-text-muted">
                {model.featured.pages.length}
              </span>
            </header>
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
                        ref={active ? activeReferenceButtonRef : undefined}
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
                  const expanded = visibleExpandedNodeIds.has(node.id);
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
              aria-current={statusActive ? "page" : undefined}
              className={`flex w-full items-center gap-2 px-3 py-3 text-left transition-colors ${
                statusActive
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:bg-elevated hover:text-text-primary"
              }`}
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
