import type { ViewLayerSummary } from "../viewgraph/types";
import { useI18n } from "../contexts/I18nContext";

interface LayerOverviewPanelProps {
  layers: ViewLayerSummary[];
  layerMatchCounts: Map<string, number>;
  onOpenLayer: (layerId: string) => void;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[68px]">
      <div className="font-heading text-base text-text-primary">{value}</div>
      <div className="text-[10px] uppercase text-text-muted">{label}</div>
    </div>
  );
}

export default function LayerOverviewPanel({
  layers,
  layerMatchCounts,
  onOpenLayer,
}: LayerOverviewPanelProps) {
  const { t } = useI18n();

  return (
    <div className="h-full min-h-0 overflow-auto bg-root px-5 py-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl text-text-primary">{t.readableViewGraph.projectOverview}</h2>
          <p className="mt-1 text-xs text-text-muted">
            {layers.length} {t.layer.label}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {layers.map((layer) => {
          const matchCount = layerMatchCounts.get(layer.id) ?? 0;

          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onOpenLayer(layer.id)}
              className={`w-full rounded-lg border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/5 ${
                matchCount > 0 ? "border-accent/40" : "border-border-subtle"
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="truncate font-heading text-lg text-text-primary">{layer.name}</h3>
                    {matchCount > 0 && (
                      <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {matchCount} {t.readableViewGraph.searchMatches}
                      </span>
                    )}
                  </div>
                  {layer.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{layer.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {layer.topFiles.slice(0, 6).map((file) => (
                      <span
                        key={file.id}
                        className="max-w-[220px] truncate rounded bg-elevated px-2 py-1 text-[11px] text-text-muted"
                        title={file.filePath}
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[360px]">
                  <Metric label={t.readableViewGraph.files} value={layer.fileCount} />
                  <Metric label={t.readableViewGraph.functions} value={layer.functionCount} />
                  <Metric label={t.readableViewGraph.classes} value={layer.classCount} />
                  <Metric label={t.readableViewGraph.modules} value={layer.moduleCount} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
