const COVERAGE_ITEMS = [
  { label: "有专门正文", color: "var(--color-graph-status-direct)" },
  { label: "仅相关资料", color: "var(--color-graph-status-context)" },
  { label: "待补正文", color: "var(--color-graph-status-missing)" },
  { label: "生成或证据异常", color: "var(--color-graph-status-problem)" },
] as const;

export default function GraphCoverageLegend() {
  return (
    <div className="uc-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2" aria-label="文档覆盖图例">
      {COVERAGE_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-text-secondary">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
