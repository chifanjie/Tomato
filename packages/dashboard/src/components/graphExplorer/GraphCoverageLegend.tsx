import type { GraphDocumentationStatus } from "../../graphExplorer/semanticGraph";

const COVERAGE_ITEMS: Array<{
  status: GraphDocumentationStatus;
  label: string;
  className: string;
}> = [
  { status: "complete", label: "完整", className: "bg-accent" },
  { status: "partial", label: "部分覆盖", className: "bg-node-module" },
  { status: "failed", label: "生成失败", className: "bg-complexity-complex" },
  { status: "unknown", label: "未评估", className: "bg-text-muted" },
];

export default function GraphCoverageLegend() {
  return (
    <div className="uc-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      {COVERAGE_ITEMS.map((item) => (
        <div key={item.status} className="flex items-center gap-2 text-xs text-text-secondary">
          <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
