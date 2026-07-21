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
  return `uc-wiki-nav-item${active ? " uc-wiki-nav-item-active" : ""}`;
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
        <p className="text-xs font-semibold tracking-[0.16em] text-text-muted">
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

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="uc-wiki-nav-sections">
          <section className="uc-wiki-nav-section" aria-labelledby="wiki-featured-heading">
            <header>
              <div>
                <h2 id="wiki-featured-heading">主干阅读</h2>
                <small>按推荐顺序理解项目</small>
              </div>
              <span className="uc-count">{model.featured.pages.length}</span>
            </header>
            <div className="uc-wiki-nav-list">
              {model.featured.pages.length === 0 ? (
                <p>暂无可发布的主干文档。</p>
              ) : model.featured.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onSelectPage(page.id)}
                  aria-current={activePageId === page.id ? "page" : undefined}
                  className={pageButtonClass(activePageId === page.id)}
                >
                  <span>{page.title}</span>
                  {activePageId === page.id && page.summary && (
                    <small>{page.summary}</small>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="uc-wiki-nav-section">
            <button
              ref={referenceTriggerRef}
              type="button"
              onClick={() => onReferenceExpandedChange(!referenceExpanded)}
              aria-expanded={referenceExpanded}
              className="uc-wiki-nav-section-trigger"
            >
              <span>
                <strong>代码参考</strong>
                <small>按目录查找文件文档</small>
              </span>
              <span className="uc-count">{model.reference.totalFiles}</span>
            </button>

            {referenceExpanded && (
              <div className="uc-wiki-nav-list">
                {visibleRows.length === 0 ? (
                  <p>暂无可浏览的文件参考。</p>
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
                        <span className="uc-wiki-path">{node.path || node.label}</span>
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
                      className="uc-wiki-branch"
                      style={{ paddingLeft: `${depth * 14 + 10}px` }}
                    >
                      <span>{branchLabel(node)}</span>
                      <small>{expanded ? "收起" : "展开"}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="uc-wiki-nav-section uc-wiki-status-destination">
            <button
              type="button"
              onClick={onSelectStatus}
              aria-current={statusActive ? "page" : undefined}
              className={pageButtonClass(statusActive)}
            >
              <span>知识库状态</span>
              <small>查看覆盖缺口与生成质量</small>
              <span className="uc-count">
                {model.maintenance.pages.length + model.reference.orphanPageIds.length}
              </span>
            </button>
          </section>
        </div>
      </div>
    </nav>
  );
}
