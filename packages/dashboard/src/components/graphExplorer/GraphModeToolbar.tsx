import type { GraphExplorerDisplayMode } from "../../graphExplorer/hierarchicalGraph";
import type { GraphModeOption } from "./graphExplorerModel";

interface GraphModeToolbarProps {
  mode: GraphExplorerDisplayMode;
  options: readonly GraphModeOption[];
  onChangeMode: (mode: GraphExplorerDisplayMode) => void;
}

export default function GraphModeToolbar({ mode, options, onChangeMode }: GraphModeToolbarProps) {
  return (
    <div className="uc-panel flex min-w-0 flex-wrap items-center gap-1 p-1" aria-label="图谱视图">
      {options.map((option) => {
        const isActive = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChangeMode(option.id)}
            aria-pressed={isActive}
            className={`flex min-h-11 items-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:bg-elevated hover:text-text-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
