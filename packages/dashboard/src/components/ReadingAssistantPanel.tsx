import { useMemo } from "react";
import { useI18n } from "../contexts/I18nContext";
import { useDashboardStore } from "../store";
import { buildReadingAssistantModel } from "./readingAssistantModel";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-elevated/70 px-3 py-2">
      <div className="font-heading text-lg text-accent">{value}</div>
      <div className="text-[10px] uppercase text-text-muted">{label}</div>
    </div>
  );
}

export default function ReadingAssistantPanel() {
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const searchResults = useDashboardStore((s) => s.searchResults);
  const drillIntoLayer = useDashboardStore((s) => s.drillIntoLayer);
  const openFileDetail = useDashboardStore((s) => s.openFileDetail);
  const { t } = useI18n();

  const model = useMemo(
    () =>
      buildReadingAssistantModel({
        graph,
        viewGraph,
        navigationLevel,
        activeLayerId,
        searchQuery,
        searchResults,
      }),
    [activeLayerId, graph, navigationLevel, searchQuery, searchResults, viewGraph],
  );

  const primaryTitle =
    model.kind === "layer" ? t.readingAssistant.topFiles : t.readingAssistant.recommendedLayers;

  return (
    <div className="h-full min-h-0 overflow-auto bg-surface px-5 py-4">
      <div className="mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {t.readingAssistant.title}
        </div>
        <h2 className="mt-1 font-heading text-xl text-text-primary">{model.title}</h2>
        {model.subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{model.subtitle}</p>
        )}
      </div>

      {model.searchSummary && (
        <section className="mb-5 rounded-md border border-accent/25 bg-accent/10 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-accent">
            {t.readingAssistant.search}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            <span className="font-mono text-text-primary">{model.searchSummary.query}</span>
            {" · "}
            {model.searchSummary.fileMatches} {t.readingAssistant.fileMatches}
            {" · "}
            {model.searchSummary.layerMatches} {t.readingAssistant.layerMatches}
          </div>
        </section>
      )}

      {model.metrics.length > 0 && (
        <section className="mb-5 grid grid-cols-2 gap-2">
          {model.metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </section>
      )}

      {model.routeSteps.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {t.readingAssistant.route}
          </h3>
          <ol className="space-y-2">
            {model.routeSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-2 rounded-md bg-elevated/60 px-3 py-2 text-xs text-text-secondary"
              >
                <span className="font-mono text-accent">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {model.primaryItems.length > 0 && (
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {primaryTitle}
          </h3>
          <div className="space-y-2">
            {model.primaryItems.map((item) => {
              const onClick =
                model.kind === "layer" ? () => openFileDetail(item.id) : () => drillIntoLayer(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={onClick}
                  className="w-full rounded-md border border-border-subtle bg-elevated/70 px-3 py-2 text-left transition-colors hover:border-accent/45 hover:bg-accent/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {item.label}
                    </span>
                    {typeof item.value === "number" && (
                      <span className="shrink-0 font-mono text-[10px] text-accent">
                        {item.value} {t.readingAssistant.functions}
                      </span>
                    )}
                  </div>
                  {item.detail && (
                    <div
                      className="mt-1 truncate font-mono text-[10px] text-text-muted"
                      title={item.detail}
                    >
                      {item.detail}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
