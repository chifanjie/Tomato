import type { GraphExplorerMode } from "../../graphExplorer/semanticGraph";

interface GraphModeToolbarProps {
  mode: GraphExplorerMode;
  focusNodeCount: number;
  onChangeMode: (mode: GraphExplorerMode) => void;
}

const MODE_LABELS: Record<GraphExplorerMode, string> = {
  global: "Global",
  semantic: "Semantic",
  architecture: "Architecture",
  call: "Call",
  coverage: "Coverage",
  evidence: "Evidence",
  focus: "Focus",
};

const MODE_ORDER: GraphExplorerMode[] = [
  "global",
  "semantic",
  "architecture",
  "call",
  "coverage",
  "evidence",
  "focus",
];

function focusTitle(focusNodeCount: number): string {
  if (focusNodeCount === 0) return "Focus mode needs graph focus from a wiki page.";
  return `Focus mode includes ${focusNodeCount} graph node${focusNodeCount === 1 ? "" : "s"}.`;
}

export default function GraphModeToolbar({ mode, focusNodeCount, onChangeMode }: GraphModeToolbarProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-surface p-1">
      {MODE_ORDER.map((item) => {
        const isActive = item === mode;
        const isFocus = item === "focus";
        const focusUnavailable = isFocus && focusNodeCount === 0;
        const disabled = focusUnavailable && !isActive;

        return (
          <button
            key={item}
            type="button"
            onClick={() => onChangeMode(item)}
            aria-pressed={isActive}
            disabled={disabled}
            title={isFocus ? focusTitle(focusNodeCount) : undefined}
            className={`flex min-h-8 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:bg-elevated hover:text-text-primary"
            }`}
          >
            <span>{MODE_LABELS[item]}</span>
            {isFocus && (
              <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] leading-none">
                {focusNodeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
