import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";

export default function ViewGraphBreadcrumb() {
  const graph = useDashboardStore((s) => s.graph);
  const viewGraph = useDashboardStore((s) => s.viewGraph);
  const activeFileId = useDashboardStore((s) => s.activeFileId);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const navigateToOverview = useDashboardStore((s) => s.navigateToOverview);
  const drillIntoLayer = useDashboardStore((s) => s.drillIntoLayer);
  const { t } = useI18n();

  const file = activeFileId ? viewGraph?.filesById.get(activeFileId) : null;
  const layerId = file?.layerId ?? activeLayerId;
  const layer = layerId ? graph?.layers.find((item) => item.id === layerId) : null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
      <button
        type="button"
        onClick={navigateToOverview}
        className="text-gold hover:text-gold-bright transition-colors"
      >
        {t.breadcrumb.project}
      </button>
      {layer && (
        <>
          <span className="text-text-muted">/</span>
          <button
            type="button"
            onClick={() => drillIntoLayer(layer.id)}
            className="text-gold hover:text-gold-bright transition-colors truncate max-w-[220px]"
            title={layer.name}
          >
            {layer.name}
          </button>
        </>
      )}
      {file && (
        <>
          <span className="text-text-muted">/</span>
          <span className="text-text-primary truncate max-w-[320px]" title={file.filePath}>
            {file.name}
          </span>
        </>
      )}
    </div>
  );
}
