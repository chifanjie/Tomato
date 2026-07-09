import type { WikiCoverageStatus } from "../../wiki/wikiIndex";

const COVERAGE_ITEMS: Array<{
  status: WikiCoverageStatus;
  label: string;
  className: string;
}> = [
  { status: "complete", label: "Complete", className: "bg-accent" },
  { status: "partial", label: "Partial", className: "bg-node-module" },
  { status: "gap", label: "Gap", className: "bg-complexity-complex" },
  { status: "unknown", label: "Unknown", className: "bg-text-muted" },
];

export default function GraphCoverageLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border-subtle bg-surface px-3 py-2">
      {COVERAGE_ITEMS.map((item) => (
        <div key={item.status} className="flex items-center gap-2 text-xs text-text-secondary">
          <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
