import type { ViewFileSummary, ViewLayerSummary } from "../viewgraph/types";
import { useI18n } from "../contexts/I18nContext";

interface LayerFileHeatmapProps {
  layer: ViewLayerSummary | null;
  files: ViewFileSummary[];
  fileMatchCounts: Map<string, number>;
  selectedFileId: string | null;
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
  onOpenFile,
}: LayerFileHeatmapProps) {
  const { t } = useI18n();

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
        <div className="shrink-0 text-right">
          <div className="font-heading text-xl text-accent">{files.length}</div>
          <div className="text-[10px] uppercase text-text-muted">{t.readableViewGraph.files}</div>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-text-muted">
          {t.readableViewGraph.noFiles}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {files.map((file) => {
            const matchCount = fileMatchCounts.get(file.id) ?? 0;
            const intensity = Math.min(1, file.functionCount / 120);

            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onOpenFile(file.id)}
                className={`min-h-[132px] rounded-lg border p-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/5 ${
                  selectedFileId === file.id || matchCount > 0 ? "outline outline-1 outline-accent/50" : ""
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
