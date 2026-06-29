import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewFileSummary, ViewLayerSummary } from "../viewgraph/types";
import type { FileCallEdge } from "../viewgraph/callRelationships";
import { getFocusedFileCallEdges } from "../viewgraph/callRelationships";
import { useI18n } from "../contexts/I18nContext";
import LayerCallOverlay, { type FileCardAnchor } from "./LayerCallOverlay";

interface LayerFileHeatmapProps {
  layer: ViewLayerSummary | null;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
  callEdges: FileCallEdge[];
  onFocusFile: (fileId: string | null) => void;
  onOpenFile: (fileId: string) => void;
}

function complexityClass(complexity: ViewFileSummary["node"]["complexity"]): string {
  if (complexity === "complex") return "border-complexity-complex/45 bg-complexity-complex/10";
  if (complexity === "moderate") return "border-accent-dim/35 bg-accent-dim/10";
  return "border-node-function/25 bg-node-function/10";
}

export default function LayerFileHeatmap({
  layer,
  files,
  fileMatchCounts,
  selectedFileId,
  callEdges,
  onFocusFile,
  onOpenFile,
}: LayerFileHeatmapProps) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [anchors, setAnchors] = useState<Map<string, FileCardAnchor>>(new Map());
  const [showCallArrows, setShowCallArrows] = useState(true);
  const visibleFileIds = useMemo(() => new Set(files.map((file) => file.id)), [files]);
  const focusedFileId = selectedFileId && visibleFileIds.has(selectedFileId) ? selectedFileId : null;
  const focusedFile = focusedFileId ? files.find((file) => file.id === focusedFileId) ?? null : null;
  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const focusedEdges = useMemo(
    () => getFocusedFileCallEdges(callEdges, focusedFileId),
    [callEdges, focusedFileId],
  );

  const setCardRef = useCallback((fileId: string) => (node: HTMLElement | null) => {
    if (node) cardRefs.current.set(fileId, node);
    else cardRefs.current.delete(fileId);
  }, []);

  const measureAnchors = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const contentRect = content.getBoundingClientRect();
    const next = new Map<string, FileCardAnchor>();
    for (const file of files) {
      const node = cardRefs.current.get(file.id);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      next.set(file.id, {
        id: file.id,
        x: rect.left - contentRect.left,
        y: rect.top - contentRect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    setAnchors((current) => {
      if (current.size !== next.size) return next;
      for (const [id, anchor] of next) {
        const old = current.get(id);
        if (
          !old
          || old.x !== anchor.x
          || old.y !== anchor.y
          || old.width !== anchor.width
          || old.height !== anchor.height
        ) {
          return next;
        }
      }
      return current;
    });
  }, [files]);

  useEffect(() => {
    measureAnchors();
    const content = contentRef.current;
    if (!content) return;

    const frame = window.requestAnimationFrame(measureAnchors);
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measureAnchors)
      : null;
    observer?.observe(content);
    for (const node of cardRefs.current.values()) observer?.observe(node);

    window.addEventListener("resize", measureAnchors);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measureAnchors);
    };
  }, [measureAnchors]);

  const focusFile = useCallback((fileId: string) => {
    onFocusFile(fileId);
  }, [onFocusFile]);

  const handleCardKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>, fileId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    focusFile(fileId);
  }, [focusFile]);

  return (
    <div className="h-full min-h-0 overflow-auto bg-root px-5 py-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-xl text-text-primary">
            {layer?.name ?? t.readableViewGraph.projectFiles}
          </h2>
          {layer?.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{layer.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-end gap-3">
          <button
            type="button"
            aria-pressed={showCallArrows}
            onClick={() => setShowCallArrows((value) => !value)}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              showCallArrows
                ? "border-accent/45 bg-accent/10 text-accent"
                : "border-border-subtle bg-elevated text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.functionDetail.callsImpact}
          </button>
          <div className="text-right">
            <div className="font-heading text-xl text-accent">{files.length}</div>
            <div className="text-[10px] uppercase text-text-muted">{t.readableViewGraph.files}</div>
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-text-muted">
          {t.readableViewGraph.noFiles}
        </div>
      ) : (
        <div ref={contentRef} className="relative pb-2">
          <LayerCallOverlay
            edges={callEdges}
            anchors={anchors}
            focusedFileId={focusedFileId}
            visible={showCallArrows}
          />
          <div className="relative z-20 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {files.map((file) => {
              const matchCount = fileMatchCounts.get(file.id) ?? 0;
              const intensity = Math.min(1, file.functionCount / 120);
              const isFocused = focusedFileId === file.id;

              return (
                <article
                  key={file.id}
                  ref={setCardRef(file.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => focusFile(file.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, file.id)}
                  className={`min-h-[156px] cursor-pointer rounded-lg border p-3 text-left shadow-sm transition-colors hover:border-accent/55 hover:bg-elevated ${
                    isFocused || matchCount > 0 ? "outline outline-1 outline-accent/50" : ""
                  } ${complexityClass(file.node.complexity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-text-primary" title={file.filePath}>
                        {file.name}
                      </h3>
                      <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={file.filePath}>
                        {file.filePath}
                      </p>
                    </div>
                    {matchCount > 0 && (
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        {matchCount}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(8, intensity * 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <span className="text-text-secondary">
                      {t.readableViewGraph.functions}: <b className="text-text-primary">{file.functionCount}</b>
                    </span>
                    <span className="text-text-secondary">
                      {t.readableViewGraph.classes}: <b className="text-text-primary">{file.classCount}</b>
                    </span>
                    <span className="text-text-secondary">
                      {t.readableViewGraph.importsOut}: <b className="text-text-primary">{file.importOutCount}</b>
                    </span>
                    <span className="text-text-secondary">
                      {t.readableViewGraph.importsIn}: <b className="text-text-primary">{file.importInCount}</b>
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-text-muted">
                      {isFocused ? t.common.focus : t.functionDetail.callsImpact}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenFile(file.id);
                      }}
                      className="shrink-0 rounded border border-border-subtle bg-surface px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      {t.readableViewGraph.openFunctions}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {showCallArrows && focusedFile && focusedEdges.length > 0 && (
            <div className="relative z-20 mt-3 max-h-32 overflow-auto rounded-md border border-border-subtle bg-surface/90 p-2 shadow-sm">
              <div className="mb-1 truncate text-[11px] font-semibold text-text-secondary" title={focusedFile.filePath}>
                {focusedFile.name}
              </div>
              <div className="space-y-1">
                {focusedEdges.map((edge) => {
                  const incoming = edge.targetFileId === focusedFile.id;
                  const relatedFileId = incoming ? edge.sourceFileId : edge.targetFileId;
                  const relatedFile = filesById.get(relatedFileId);
                  return (
                    <div
                      key={`${edge.source}:${edge.sourceFileId}->${edge.targetFileId}`}
                      className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded bg-elevated/60 px-2 py-1 text-[11px]"
                    >
                      <span className="font-mono text-accent">{incoming ? "←" : "→"}</span>
                      <span className="truncate text-text-secondary" title={relatedFile?.filePath ?? relatedFileId}>
                        {relatedFile?.name ?? relatedFileId}
                      </span>
                      <span className="shrink-0 text-text-muted">
                        {edge.source === "calls" ? t.functionDetail.callsImpact : t.functionDetail.estimatedImpact} · {edge.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
