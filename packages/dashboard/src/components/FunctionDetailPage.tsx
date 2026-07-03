import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GraphNode, KnowledgeGraph } from "@understand-anything/core/types";
import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";
import { buildFunctionImpact } from "../viewgraph/functionImpact";
import type { FunctionDot, ViewFileSummary } from "../viewgraph/types";
import FunctionMatrixPanel from "./FunctionMatrixPanel";
import ViewGraphBreadcrumb from "./ViewGraphBreadcrumb";

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

function lineLabel(nodeOrDot: Pick<GraphNode, "lineRange"> | Pick<FunctionDot, "lineRange">): string {
  return nodeOrDot.lineRange ? `L${nodeOrDot.lineRange[0]}-${nodeOrDot.lineRange[1]}` : "";
}

function useContainedNodes(fileId: string | null, type: GraphNode["type"]): GraphNode[] {
  const graph = useDashboardStore((s) => s.graph);
  return useMemo(() => {
    if (!graph || !fileId) return [];
    return graph.edges
      .filter((edge) => edge.type === "contains" && edge.source === fileId)
      .map((edge) => graph.nodes.find((node) => node.id === edge.target))
      .filter((node): node is GraphNode => node !== undefined && node.type === type)
      .sort((a, b) => (a.lineRange?.[0] ?? 0) - (b.lineRange?.[0] ?? 0));
  }, [graph, fileId, type]);
}

function ObjectButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  const className = "w-full min-w-0 rounded-md px-2.5 py-2 text-left text-xs transition-colors";
  const body = (
    <>
      <div className="truncate text-text-primary" title={label}>{label}</div>
      {detail && <div className="mt-0.5 truncate font-mono text-[10px] text-text-muted" title={detail}>{detail}</div>}
    </>
  );

  if (!onClick) {
    return <div className={`${className} bg-elevated/60 border border-border-subtle`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} bg-elevated/60 border border-border-subtle hover:border-accent/40 hover:bg-accent/5`}
    >
      {body}
    </button>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
        {typeof count === "number" && <span className="text-[10px] font-mono text-text-muted">{count}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function buildTopConnectedDots(file: ViewFileSummary, graph: KnowledgeGraph): FunctionDot[] {
  const fileFunctionIds = new Set(file.functionDots.map((dot) => dot.nodeId));
  const counts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.type !== "calls") continue;
    if (fileFunctionIds.has(edge.source)) counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    if (fileFunctionIds.has(edge.target)) counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return [...file.functionDots]
    .sort((a, b) => (counts.get(b.nodeId) ?? 0) - (counts.get(a.nodeId) ?? 0))
    .filter((dot) => (counts.get(dot.nodeId) ?? 0) > 0)
    .slice(0, 8);
}

export function selectInitialFunctionId(
  file: ViewFileSummary | null,
  selectedNodeId: string | null,
): string | null {
  if (!file) return null;
  const selectedDotFromStore = file.functionDots.find((dot) => dot.nodeId === selectedNodeId);
  return selectedDotFromStore?.nodeId ?? file.functionDots[0]?.nodeId ?? null;
}

interface FunctionDetailPageProps {
  presentation?: "default" | "workbench";
}

export default function FunctionDetailPage({
  presentation = "default",
}: FunctionDetailPageProps) {
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const closeFileDetail = useDashboardStore((s) => s.closeFileDetail);
  const navigateToNode = useDashboardStore((s) => s.navigateToNode);
  const { t } = useI18n();
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);

  const file = activeFileId ? viewGraph?.filesById.get(activeFileId) ?? null : null;
  const classNodes = useContainedNodes(file?.id ?? null, "class");

  useEffect(() => {
    setSelectedFunctionId(selectInitialFunctionId(file, selectedNodeId));
  }, [file, selectedNodeId]);

  const selectedDot = file?.functionDots.find((dot) => dot.nodeId === selectedFunctionId) ?? file?.functionDots[0] ?? null;
  const selectedNode = selectedDot && graph ? graph.nodes.find((node) => node.id === selectedDot.nodeId) ?? null : null;
  const impact = useMemo(
    () => (graph && selectedDot ? buildFunctionImpact(graph, selectedDot.nodeId) : null),
    [graph, selectedDot],
  );
  const topConnectedDots = useMemo(
    () => (graph && file ? buildTopConnectedDots(file, graph) : []),
    [graph, file],
  );
  const linkedFileIds = impact ? unique([...impact.outgoingFileIds, ...impact.incomingFileIds]) : [];
  const relatedFunctionIds = impact ? unique([...impact.outgoingFunctionIds, ...impact.incomingFunctionIds]) : [];

  if (!graph || !file) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-root text-text-muted text-sm">
        {t.common.noGraphLoaded}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full flex flex-col bg-root">
      {presentation !== "workbench" && (
        <div className="shrink-0 border-b border-border-subtle bg-surface px-5 py-3 flex items-center justify-between gap-4">
          <ViewGraphBreadcrumb />
          <button
            type="button"
            onClick={closeFileDetail}
            className="shrink-0 rounded-md border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
          >
            {t.functionDetail.backToGraph}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto lg:overflow-hidden flex flex-col lg:flex-row">
        <aside className="w-full max-h-[280px] shrink-0 overflow-auto border-b border-border-subtle bg-surface px-4 py-4 space-y-5 lg:max-h-none lg:w-[280px] lg:border-b-0 lg:border-r">
          <Section title={t.common.file}>
            <ObjectButton label={file.name} detail={file.filePath} />
          </Section>

          {classNodes.length > 0 && (
            <Section title={t.functionDetail.classes} count={classNodes.length}>
              {classNodes.slice(0, 12).map((node) => (
                <ObjectButton
                  key={node.id}
                  label={node.name}
                  detail={lineLabel(node)}
                  onClick={() => navigateToNode(node.id)}
                />
              ))}
            </Section>
          )}

          <Section title={t.functionDetail.exportedFunctions} count={file.functionDots.filter((dot) => dot.isExported).length}>
            {file.functionDots.filter((dot) => dot.isExported).slice(0, 12).map((dot) => (
              <ObjectButton
                key={dot.nodeId}
                label={dot.name}
                detail={lineLabel(dot)}
                onClick={() => setSelectedFunctionId(dot.nodeId)}
              />
            ))}
          </Section>

          {topConnectedDots.length > 0 && (
            <Section title={t.functionDetail.topConnected} count={topConnectedDots.length}>
              {topConnectedDots.map((dot) => (
                <ObjectButton
                  key={dot.nodeId}
                  label={dot.name}
                  detail={lineLabel(dot)}
                  onClick={() => setSelectedFunctionId(dot.nodeId)}
                />
              ))}
            </Section>
          )}
        </aside>

        <main className="w-full min-w-0 min-h-[560px] shrink-0 lg:min-h-0 lg:flex-1 lg:shrink">
          {file.functionDots.length > 0 ? (
            <FunctionMatrixPanel
              file={file}
              selectedFunctionId={selectedDot?.nodeId ?? null}
              onSelectFunction={setSelectedFunctionId}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-text-muted">
              {t.functionDetail.noFunctions}
            </div>
          )}
        </main>

        <aside className="w-full shrink-0 overflow-auto border-t border-border-subtle bg-surface px-5 py-4 lg:w-[360px] lg:border-l lg:border-t-0">
          {selectedDot && selectedNode && impact ? (
            <div className="space-y-5">
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    {selectedDot.group}
                  </span>
                  <span className="rounded border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted">
                    {selectedDot.complexity}
                  </span>
                </div>
                <h2 className="font-heading text-xl text-text-primary break-words">{selectedDot.name}</h2>
                {selectedNode.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{selectedNode.summary}</p>
                )}
                <div className="mt-3 rounded-md border border-border-subtle bg-elevated/60 p-3 text-xs">
                  <div className="font-mono text-text-secondary truncate" title={file.filePath}>{file.filePath}</div>
                  {selectedDot.lineRange && (
                    <div className="mt-1 font-mono text-text-muted">{lineLabel(selectedDot)}</div>
                  )}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border-subtle bg-elevated/60 p-3">
                  <div className="text-lg font-heading text-accent">{impact.totalDownstream}</div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">{t.functionDetail.downstream}</div>
                </div>
                <div className="rounded-md border border-border-subtle bg-elevated/60 p-3">
                  <div className="text-lg font-heading text-accent">{impact.totalUpstream}</div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">{t.functionDetail.upstream}</div>
                </div>
              </section>

              <section className="rounded-md border border-border-subtle bg-elevated/60 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {impact.source === "calls" ? t.functionDetail.callsImpact : t.functionDetail.estimatedImpact}
                </h3>
                {impact.source === "imports" && (
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    {t.functionDetail.estimatedImpactNote}
                  </p>
                )}
              </section>

              {linkedFileIds.length > 0 && (
                <Section title={t.functionDetail.linkedFiles} count={linkedFileIds.length}>
                  {linkedFileIds.slice(0, 10).map((id) => {
                    const node = graph.nodes.find((item) => item.id === id);
                    return (
                      <ObjectButton
                        key={id}
                        label={node?.name ?? id}
                        detail={node?.filePath}
                        onClick={() => navigateToNode(id)}
                      />
                    );
                  })}
                </Section>
              )}

              {relatedFunctionIds.length > 0 && (
                <Section title={t.functionDetail.relatedFunctions} count={relatedFunctionIds.length}>
                  {relatedFunctionIds.slice(0, 10).map((id) => {
                    const node = graph.nodes.find((item) => item.id === id);
                    return (
                      <ObjectButton
                        key={id}
                        label={node?.name ?? id}
                        detail={node?.filePath ? `${node.filePath} ${lineLabel(node)}` : lineLabel(node ?? selectedNode)}
                        onClick={() => navigateToNode(id)}
                      />
                    );
                  })}
                </Section>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-text-muted">
              {t.functionDetail.noFunctions}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
