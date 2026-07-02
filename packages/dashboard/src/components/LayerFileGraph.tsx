import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Edge, NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { KnowledgeGraph } from "@understand-anything/core/types";
import { useI18n } from "../contexts/I18nContext";
import { useDashboardStore } from "../store";
import { applyElkLayout } from "../utils/elk-layout";
import { mergeElkPositions, nodesToElkInput } from "../utils/layout";
import { buildFileRelationships, type FileRelationship } from "../viewgraph/fileRelationships";
import { buildLayerFileFlowModel } from "../viewgraph/layerFileGraphModel";
import type { ViewFileSummary, ViewGraph, ViewLayerSummary } from "../viewgraph/types";
import LayerFileGraphNode from "./LayerFileGraphNode";
import type { LayerFileGraphFlowNode } from "./LayerFileGraphNode";

const FILE_NODE_WIDTH = 220;
const FILE_NODE_HEIGHT = 112;
const MAX_DEFAULT_EDGES = 120;

const nodeTypes = {
  "layer-file": LayerFileGraphNode,
};

interface LayerFileGraphProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  layer: ViewLayerSummary | null;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
  onOpenFile: (fileId: string) => void;
}

interface RelationshipListProps {
  title: string;
  relationships: FileRelationship[];
  direction: "incoming" | "outgoing";
  filesById: Map<string, ViewFileSummary>;
  emptyText: string;
  onSelectFile: (fileId: string) => void;
  onOpenFile: (fileId: string) => void;
}

function RelationshipList({
  title,
  relationships,
  direction,
  filesById,
  emptyText,
  onSelectFile,
  onOpenFile,
}: RelationshipListProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-lg border border-border-subtle bg-surface/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-text-secondary">{title}</h3>
        <span className="rounded bg-panel px-2 py-0.5 text-[10px] font-semibold text-text-muted">
          {relationships.length}
        </span>
      </div>

      {relationships.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {relationships.map((relationship) => {
            const relatedFileId =
              direction === "incoming" ? relationship.sourceFileId : relationship.targetFileId;
            const relatedFile = filesById.get(relatedFileId);

            const relatedFileName = relatedFile?.name ?? relatedFileId;

            return (
              <div
                key={relationship.id}
                className="flex items-stretch gap-2 rounded border border-border-subtle bg-elevated/70 p-2 transition-colors hover:border-accent/55 hover:bg-accent/5"
              >
                <button
                  type="button"
                  onClick={() => onSelectFile(relatedFileId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-xs font-medium text-text-primary">
                    {relatedFileName}
                  </span>
                  {relatedFile?.filePath && (
                    <span className="mt-1 block truncate font-mono text-[10px] text-text-muted">
                      {relatedFile.filePath}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    {relationship.count}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenFile(relatedFileId)}
                    title={`${t.readingAssistant.open} ${relatedFileName}`}
                    aria-label={`${t.readingAssistant.open} ${relatedFileName}`}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border-subtle text-text-muted transition-colors hover:border-accent/55 hover:text-accent"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 4h6m0 0v6m0-6L10 14m-4 6h12a2 2 0 0 0 2-2v-5M6 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface RelationshipPanelProps {
  selectedDetails: ReturnType<typeof buildLayerFileFlowModel>["selectedDetails"];
  filesById: Map<string, ViewFileSummary>;
  onSelectFile: (fileId: string) => void;
  onOpenFile: (fileId: string) => void;
}

function RelationshipPanel({
  selectedDetails,
  filesById,
  onSelectFile,
  onOpenFile,
}: RelationshipPanelProps) {
  const { t } = useI18n();

  if (!selectedDetails) {
    return (
      <aside className="hidden h-full w-[320px] shrink-0 items-center justify-center border-l border-border-subtle bg-panel px-6 text-center text-sm text-text-muted lg:flex">
        {t.readableViewGraph.selectFileForRelationships}
      </aside>
    );
  }

  const { file, incoming, outgoing } = selectedDetails;

  return (
    <aside className="h-[220px] w-full shrink-0 overflow-auto border-t border-border-subtle bg-panel p-3 lg:h-full lg:w-[320px] lg:border-l lg:border-t-0 lg:p-4">
      <div className="rounded-lg border border-border-subtle bg-elevated p-3">
        <h2 className="truncate text-sm font-semibold text-text-primary" title={file.filePath}>
          {file.name}
        </h2>
        <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={file.filePath}>
          {file.filePath}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-surface px-2 py-2">
            <div className="font-heading text-lg text-accent">{incoming.length}</div>
            <div className="text-[10px] uppercase text-text-muted">{t.functionDetail.upstream}</div>
          </div>
          <div className="rounded bg-surface px-2 py-2">
            <div className="font-heading text-lg text-accent">{outgoing.length}</div>
            <div className="text-[10px] uppercase text-text-muted">{t.functionDetail.downstream}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <RelationshipList
          title={t.functionDetail.upstream}
          relationships={incoming}
          direction="incoming"
          filesById={filesById}
          emptyText={t.readableViewGraph.noRelationships}
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
        />
        <RelationshipList
          title={t.functionDetail.downstream}
          relationships={outgoing}
          direction="outgoing"
          filesById={filesById}
          emptyText={t.readableViewGraph.noRelationships}
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
        />
      </div>
    </aside>
  );
}

interface LayerFileGraphCanvasProps {
  graph: KnowledgeGraph;
  viewGraph: ViewGraph;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
  onOpenFile: (fileId: string) => void;
}

function LayerFileGraphCanvas({
  graph,
  viewGraph,
  files,
  fileMatchCounts,
  selectedFileId: selectedFileIdProp,
  onOpenFile,
}: LayerFileGraphCanvasProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(selectedFileIdProp);
  const [layout, setLayout] = useState<{ nodes: LayerFileGraphFlowNode[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });

  useEffect(() => {
    setSelectedFileId(selectedFileIdProp);
  }, [selectedFileIdProp]);

  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const layerFileIds = useMemo(() => new Set(files.map((file) => file.id)), [files]);
  const relationships = useMemo(
    () => buildFileRelationships(graph, viewGraph, layerFileIds),
    [graph, viewGraph, layerFileIds],
  );

  const model = useMemo(
    () =>
      buildLayerFileFlowModel({
        files,
        relationships,
        selectedFileId,
        fileMatchCounts,
        maxDefaultEdges: MAX_DEFAULT_EDGES,
      }),
    [files, relationships, selectedFileId, fileMatchCounts],
  );

  useEffect(() => {
    if (model.nodes.length === 0) {
      setLayout({ nodes: [], edges: [] });
      return;
    }

    let cancelled = false;
    const dims = new Map(
      model.nodes.map((node) => [node.id, { width: FILE_NODE_WIDTH, height: FILE_NODE_HEIGHT }]),
    );
    const elkInput = nodesToElkInput(model.nodes, model.edges, dims, {
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "SPLINES",
      "elk.layered.spacing.nodeNodeBetweenLayers": "140",
      "elk.spacing.nodeNode": "70",
      "elk.padding": "[top=48,left=48,right=48,bottom=48]",
    });

    applyElkLayout(elkInput, { strict: import.meta.env.DEV })
      .then(({ positioned, issues }) => {
        if (cancelled) return;
        if (issues.length > 0) {
          useDashboardStore.getState().appendLayoutIssues(issues);
        }
        setLayout({
          nodes: mergeElkPositions(model.nodes, positioned),
          edges: model.edges,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[layer file ELK] layout failed:", err);
        setLayout({ nodes: model.nodes, edges: model.edges });
      });

    return () => {
      cancelled = true;
    };
  }, [model]);

  const selectFile = useCallback(
    (fileId: string | null) => {
      setSelectedFileId(fileId);
    },
    [],
  );

  const handleNodeClick = useCallback<NodeMouseHandler<LayerFileGraphFlowNode>>(
    (_, node) => {
      selectFile(node.id);
    },
    [selectFile],
  );

  const handleNodeDoubleClick = useCallback<NodeMouseHandler<LayerFileGraphFlowNode>>(
    (_, node) => {
      onOpenFile(node.id);
    },
    [onOpenFile],
  );

  const handlePaneClick = useCallback(() => {
    selectFile(null);
  }, [selectFile]);

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="min-h-[360px] min-w-0 flex-1">
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          edgesReconnectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--color-border-subtle)"
          />
          <Controls />
          <MiniMap
            nodeColor="var(--color-accent)"
            maskColor="var(--glass-bg)"
            className="!border !border-border-subtle !bg-surface"
          />
        </ReactFlow>
      </div>
      <RelationshipPanel
        selectedDetails={model.selectedDetails}
        filesById={filesById}
        onSelectFile={selectFile}
        onOpenFile={onOpenFile}
      />
    </div>
  );
}

export default function LayerFileGraph({
  graph,
  viewGraph,
  layer,
  files,
  fileMatchCounts,
  selectedFileId,
  onOpenFile,
}: LayerFileGraphProps) {
  const { t } = useI18n();

  if (files.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-root px-5 py-4">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl text-text-primary">
              {layer?.name ?? t.readableViewGraph.projectFiles}
            </h2>
            {layer?.description && (
              <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{layer.description}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-heading text-xl text-accent">0</div>
            <div className="text-[10px] uppercase text-text-muted">{t.readableViewGraph.files}</div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-text-muted">
          {t.readableViewGraph.noFiles}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-root">
      <div className="flex shrink-0 items-end justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-xl text-text-primary">
            {layer?.name ?? t.readableViewGraph.projectFiles}
          </h2>
          {layer?.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{layer.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-heading text-xl text-accent">{files.length}</div>
          <div className="text-[10px] uppercase text-text-muted">{t.readableViewGraph.files}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <LayerFileGraphCanvas
            graph={graph}
            viewGraph={viewGraph}
            files={files}
            fileMatchCounts={fileMatchCounts}
            selectedFileId={selectedFileId}
            onOpenFile={onOpenFile}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
