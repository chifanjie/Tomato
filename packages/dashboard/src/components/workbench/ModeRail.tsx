interface RailAction {
  id: string;
  label: string;
  title: string;
  disabled?: boolean;
  icon: "structure" | "knowledge" | "risk" | "search" | "settings";
}

const actions: RailAction[] = [
  { id: "structure", label: "Structure", title: "Structure mode", icon: "structure" },
  { id: "knowledge", label: "Knowledge", title: "Knowledge mode is coming soon", icon: "knowledge", disabled: true },
  { id: "risk", label: "Risk", title: "Risk mode is coming soon", icon: "risk", disabled: true },
  { id: "search", label: "Search", title: "Search mode is coming soon", icon: "search", disabled: true },
  { id: "settings", label: "Settings", title: "Settings are coming soon", icon: "settings", disabled: true },
];

function ModeIcon({ icon }: { icon: RailAction["icon"] }) {
  if (icon === "structure") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM10 9h4M17 10v4" />
      </svg>
    );
  }

  if (icon === "knowledge") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Zm2 4h7M8 12h6" />
      </svg>
    );
  }

  if (icon === "risk") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3 3 20h18L12 3Zm0 6v5m0 3h.01" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8 3.5h-2M6 12H4m12.7-4.7 1.4-1.4M5.9 18.1l1.4-1.4m0-9.4L5.9 5.9m12.2 12.2-1.4-1.4" />
    </svg>
  );
}

export default function ModeRail() {
  return (
    <nav
      aria-label="Workbench modes"
      className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-border-subtle bg-surface px-2 py-3"
    >
      {actions.map((action) => {
        const isActive = action.id === "structure";
        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            aria-label={action.label}
            aria-current={isActive ? "page" : undefined}
            title={action.title}
            className={`flex h-11 w-11 items-center justify-center rounded-md border transition-colors ${
              isActive
                ? "border-accent/55 bg-accent/15 text-accent shadow-sm shadow-accent/10"
                : "border-transparent text-text-muted"
            } ${action.disabled ? "cursor-not-allowed opacity-35" : "hover:border-border-medium hover:bg-elevated hover:text-text-primary"}`}
          >
            <ModeIcon icon={action.icon} />
          </button>
        );
      })}
    </nav>
  );
}
