import type { GraphExplorerMode } from "../../graphExplorer/semanticGraph";

interface GraphModeToolbarProps {
  mode: GraphExplorerMode;
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

export default function GraphModeToolbar({ mode, onChangeMode }: GraphModeToolbarProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-surface p-1">
      {MODE_ORDER.map((item) => {
        const isActive = item === mode;

        return (
          <button
            key={item}
            type="button"
            onClick={() => onChangeMode(item)}
            aria-pressed={isActive}
            className={`min-h-8 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:bg-elevated hover:text-text-primary"
            }`}
          >
            {MODE_LABELS[item]}
          </button>
        );
      })}
    </div>
  );
}
