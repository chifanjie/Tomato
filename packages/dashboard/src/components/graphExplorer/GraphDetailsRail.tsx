import { useEffect, useState } from "react";
import type { WikiEvidenceV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { WikiTarget } from "../../wiki/wikiContent";
import type { GraphExplorerView, GraphSelectionDetails } from "./graphExplorerModel";
import { graphNodeTypeLabel } from "./semanticGraphCanvasModel";

export type GraphInspectorSide = "left" | "right";

export interface GraphDetailsRailProps {
  view: GraphExplorerView;
  open: boolean;
  side: GraphInspectorSide;
  onClose: () => void;
  onSelectObject: (nodeId: string) => void;
  onOpenScope: (scopeId: string) => void;
  onOpenCluster: (scopeId: string, clusterId: string) => void;
  onOpenFile: (scopeId: string, clusterId: string, fileId: string) => void;
  onSelectWikiTarget: (target: WikiTarget) => unknown;
  onRequestGlobalSearch: () => void;
  onRequestGraphQuickJump: () => void;
}

export function resolveGraphInspectorSide(input: {
  selectedScreenBounds: { left: number; right: number; top: number; bottom: number } | null;
  frameWidth: number;
  inspectorWidth: number;
  gap: number;
  compact: boolean;
}): GraphInspectorSide {
  if (input.compact || !input.selectedScreenBounds) return "right";
  const rightOverlayLeft = input.frameWidth - input.inspectorWidth - input.gap;
  return input.selectedScreenBounds.right + input.gap > rightOverlayLeft ? "left" : "right";
}

const PAGE_PREVIEW_LIMIT = 8;
const EVIDENCE_PREVIEW_LIMIT = 10;

const EVIDENCE_LABELS: Record<WikiEvidenceV2["evidenceType"], string> = {
  production: "生产代码",
  configuration: "配置",
  test: "测试",
  documentation: "文档",
};

function selectionTitle(selection: GraphSelectionDetails): string {
  return selection.kind === "raw" ? selection.node.name : selection.node.label;
}

function RelatedNodes({
  title,
  nodes,
  onSelectObject,
}: {
  title: string;
  nodes: GraphSelectionDetails["upstream"];
  onSelectObject: (nodeId: string) => void;
}) {
  return (
    <section className="uc-graph-inspector__section">
      <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
      {nodes.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">暂无可见关系</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelectObject(node.id)}
                className="w-full rounded-md border border-border-subtle px-2.5 py-2 text-left transition-colors hover:border-accent/35 hover:bg-accent/5"
              >
                <span className="block truncate text-xs font-medium text-text-primary">{node.label}</span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">{node.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RelationshipOverflowNotice({
  hiddenCount,
  onRequestGraphQuickJump,
}: {
  hiddenCount: number;
  onRequestGraphQuickJump: () => void;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <section className="uc-graph-inspector__section">
      <h3 className="text-xs font-semibold text-text-primary">未展开关联</h3>
      <p className="mt-2 text-xs leading-5 text-text-muted">
        为保持图谱可读，另有 {hiddenCount} 个一跳关联对象未在画布和详情中展开。
      </p>
      <button
        type="button"
        onClick={onRequestGraphQuickJump}
        className="mt-2 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent/35 hover:text-accent"
      >
        打开图谱快速定位
      </button>
    </section>
  );
}

function OverflowNotice({ hiddenCount, unit, onRequestGlobalSearch }: {
  hiddenCount: number;
  unit: "篇" | "项";
  onRequestGlobalSearch: () => void;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <div className="mt-3 border-t border-border-subtle pt-3">
      <p className="text-xs leading-5 text-text-muted">
        另有 {hiddenCount} {unit}未在此预览，可前往代码参考或使用全局搜索继续查找。
      </p>
      <button
        type="button"
        onClick={onRequestGlobalSearch}
        className="mt-2 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent/35 hover:text-accent"
      >
        用全局搜索继续查找
      </button>
    </div>
  );
}

function PageList({ title, pages, emptyText, onRequestGlobalSearch }: {
  title: string;
  pages: WikiPageV2[];
  emptyText: string;
  onRequestGlobalSearch: () => void;
}) {
  return (
    <section className="uc-graph-inspector__section">
      <h3 className="text-xs font-semibold text-text-primary">{title}（共 {pages.length} 篇）</h3>
      {pages.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {pages.slice(0, PAGE_PREVIEW_LIMIT).map((page) => (
            <li key={page.id} className="border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-text-primary">{page.title}</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">{page.summary}</p>
              <p className="uc-code-ref mt-1">{page.markdownPath}</p>
            </li>
          ))}
        </ul>
      )}
      <OverflowNotice
        hiddenCount={pages.length - PAGE_PREVIEW_LIMIT}
        unit="篇"
        onRequestGlobalSearch={onRequestGlobalSearch}
      />
    </section>
  );
}

function EvidenceList({ evidence, onRequestGlobalSearch }: {
  evidence: WikiEvidenceV2[];
  onRequestGlobalSearch: () => void;
}) {
  return (
    <section className="uc-graph-inspector__section">
      <h3 className="text-xs font-semibold text-text-primary">源码证据（共 {evidence.length} 项）</h3>
      {evidence.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">暂无精确证据记录</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {evidence.slice(0, EVIDENCE_PREVIEW_LIMIT).map((item) => (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-text-primary">{item.filePath}</p>
                <span className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-xs text-text-muted">
                  {EVIDENCE_LABELS[item.evidenceType]}
                </span>
              </div>
              <p className="uc-code-ref mt-1">{item.filePath}:{item.lineRange[0]}-{item.lineRange[1]}</p>
              {item.excerpt && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-root/70 px-2 py-1.5 text-[13px] leading-5 text-text-secondary">
                  {item.excerpt}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
      <OverflowNotice
        hiddenCount={evidence.length - EVIDENCE_PREVIEW_LIMIT}
        unit="项"
        onRequestGlobalSearch={onRequestGlobalSearch}
      />
    </section>
  );
}

function Overview({ selection }: { selection: GraphSelectionDetails }) {
  if (selection.kind === "raw") {
    const lineRange = selection.node.lineRange
      ? `${selection.node.lineRange[0]}-${selection.node.lineRange[1]}`
      : null;
    return (
      <section className="uc-graph-inspector__section">
        <h3 className="text-xs font-semibold text-text-primary">节点职责</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {selection.node.summary || "暂无职责说明"}
        </p>
        <dl className="mt-3 grid gap-2 text-xs">
          <div><dt className="text-text-muted">类型</dt><dd className="mt-0.5 text-text-primary">{graphNodeTypeLabel(selection.node.type)}</dd></div>
          {selection.node.filePath && (
            <div><dt className="text-text-muted">路径</dt><dd className="uc-code-ref mt-0.5">{selection.node.filePath}</dd></div>
          )}
          {lineRange && (
            <div><dt className="text-text-muted">行号</dt><dd className="mt-0.5 font-mono text-[13px] text-text-primary">{lineRange}</dd></div>
          )}
          <div><dt className="text-text-muted">节点 ID</dt><dd className="uc-code-ref mt-0.5">{selection.id}</dd></div>
        </dl>
      </section>
    );
  }

  const counts = selection.documentationCounts;
  return (
    <section className="uc-graph-inspector__section">
      <h3 className="text-xs font-semibold text-text-primary">
        {selection.kind === "boundary" ? "外部范围" : "范围概览"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{selection.responsibility}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-text-muted">有专门正文</dt><dd className="mt-0.5 text-text-primary">{counts.direct}/{counts.total}</dd></div>
        <div><dt className="text-text-muted">仅相关资料</dt><dd className="mt-0.5 text-text-primary">{counts.context}</dd></div>
        <div><dt className="text-text-muted">待补正文</dt><dd className="mt-0.5 text-text-primary">{counts.none}</dd></div>
        <div><dt className="text-text-muted">生成或证据异常</dt><dd className="mt-0.5 text-text-primary">{counts.problem}</dd></div>
      </dl>
    </section>
  );
}

export default function GraphDetailsRail({
  view,
  open,
  side,
  onClose,
  onSelectObject,
  onOpenScope,
  onOpenCluster,
  onOpenFile,
  onSelectWikiTarget,
  onRequestGlobalSearch,
  onRequestGraphQuickJump,
}: GraphDetailsRailProps) {
  const compact = useIsMobile(1024);
  const [sheetSize, setSheetSize] = useState<"half" | "full">("half");

  useEffect(() => {
    if (!open) setSheetSize("half");
  }, [open]);

  if (!open) return null;

  const { selection, hiddenSelectedNode } = view;
  const heading = hiddenSelectedNode
    ? "当前层级未显示所选节点"
    : selection
      ? selectionTitle(selection)
      : "选择一个图谱元素";
  const drillTarget = selection?.drillTarget ?? null;
  const primaryDirectPageId = selection?.primaryDirectPageId ?? null;

  return (
    <aside
      role="complementary"
      aria-label="图谱详情"
      data-side={side}
      data-sheet-size={compact ? sheetSize : undefined}
      className="uc-graph-inspector"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-muted">图谱详情</p>
          <h2 className="mt-1 truncate text-base font-semibold text-text-primary">{heading}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {compact && (
            <button
              type="button"
              aria-label={sheetSize === "half" ? "展开全屏图谱详情" : "收起半屏图谱详情"}
              onClick={() => setSheetSize((current) => current === "half" ? "full" : "half")}
              className="rounded-md px-2 text-xs font-semibold text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              <span aria-hidden="true">{sheetSize === "half" ? "全屏" : "半屏"}</span>
              <span className="sr-only">
                {sheetSize === "half" ? "展开全屏图谱详情" : "收起半屏图谱详情"}
              </span>
            </button>
          )}
          <button
            type="button"
            aria-label="关闭图谱详情"
            onClick={onClose}
            className="grid rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
            <span className="sr-only">关闭图谱详情</span>
          </button>
        </div>
      </header>

      <div className="uc-graph-inspector__scroll">
        {hiddenSelectedNode ? (
          <section className="uc-graph-inspector__section">
            <p className="text-sm font-medium text-text-primary">{hiddenSelectedNode.name}</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              当前层级或模式没有显示这个节点。请返回包含它的范围，或切换到可用的关系视图后继续查看。
            </p>
            <p className="uc-code-ref mt-3">{hiddenSelectedNode.id}</p>
          </section>
        ) : !selection ? (
          <p className="uc-graph-inspector__section text-sm leading-6 text-text-muted">
            选择节点、范围或外部入口后，可查看职责、上下游、正文与源码证据。
          </p>
        ) : (
          <>
            <Overview selection={selection} />

            {(drillTarget || primaryDirectPageId) && (
              <section className="uc-graph-inspector__section space-y-2">
                {drillTarget?.kind === "scope" && (
                  <button
                    type="button"
                    onClick={() => onOpenScope(drillTarget.scopeId)}
                    className="min-h-11 w-full rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent/35 hover:bg-accent/5"
                  >
                    {selection.kind === "boundary" ? "进入范围" : "查看范围"}
                  </button>
                )}
                {drillTarget?.kind === "file" && (
                  <button
                    type="button"
                    onClick={() => onOpenFile(
                      drillTarget.scopeId,
                      drillTarget.clusterId,
                      drillTarget.fileId,
                    )}
                    className="min-h-11 w-full rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent/35 hover:bg-accent/5"
                  >
                    查看文件关系
                  </button>
                )}
                {drillTarget?.kind === "cluster" && (
                  <button
                    type="button"
                    onClick={() => onOpenCluster(drillTarget.scopeId, drillTarget.clusterId)}
                    className="min-h-11 w-full rounded-md border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent/35 hover:bg-accent/5"
                  >
                    查看目录
                  </button>
                )}
                {primaryDirectPageId && (
                  <button
                    type="button"
                    onClick={() => onSelectWikiTarget({ pageId: primaryDirectPageId })}
                    className="w-full rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
                  >
                    阅读正文
                  </button>
                )}
              </section>
            )}

            <div className="grid">
              <RelatedNodes title="上游" nodes={selection.upstream} onSelectObject={onSelectObject} />
              <RelatedNodes title="下游" nodes={selection.downstream} onSelectObject={onSelectObject} />
            </div>
            <RelationshipOverflowNotice
              hiddenCount={view.selectionExpansion.hiddenNeighborCount}
              onRequestGraphQuickJump={onRequestGraphQuickJump}
            />
            <PageList
              title="专门正文"
              pages={selection.directPages}
              emptyText="暂无专门正文"
              onRequestGlobalSearch={onRequestGlobalSearch}
            />
            <PageList
              title="相关资料"
              pages={selection.contextPages}
              emptyText="暂无相关资料"
              onRequestGlobalSearch={onRequestGlobalSearch}
            />
            <EvidenceList
              evidence={selection.evidence}
              onRequestGlobalSearch={onRequestGlobalSearch}
            />
          </>
        )}
      </div>
    </aside>
  );
}
