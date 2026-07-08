type RailActionId = "graph" | "route" | "knowledge" | "focus" | "search";

interface RailAction {
  id: RailActionId;
  label: string;
  title: string;
  pressed?: boolean;
  icon: RailActionId;
  onClick: () => void;
}

interface ModeRailProps {
  routeVisible: boolean;
  knowledgeVisible: boolean;
  onShowGraph: () => void;
  onToggleRoute: () => void;
  onToggleKnowledge: () => void;
  onFocusActive: () => void;
  onFocusSearch: () => void;
}

function ModeIcon({ icon }: { icon: RailAction["icon"] }) {
  if (icon === "graph") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM10 9h4M17 10v4" />
      </svg>
    );
  }

  if (icon === "route") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 5h10M7 12h10M7 19h10M4 5h.01M4 12h.01M4 19h.01" />
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

  if (icon === "focus") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v3m0 8v3M5 12h3m8 0h3m-7 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
    </svg>
  );
}

export default function ModeRail({
  routeVisible,
  knowledgeVisible,
  onShowGraph,
  onToggleRoute,
  onToggleKnowledge,
  onFocusActive,
  onFocusSearch,
}: ModeRailProps) {
  const actions: RailAction[] = [
    { id: "graph", label: "图谱", title: "回到图谱总览", icon: "graph", pressed: true, onClick: onShowGraph },
    { id: "route", label: "路线", title: routeVisible ? "隐藏引导路线" : "显示引导路线", icon: "route", pressed: routeVisible, onClick: onToggleRoute },
    { id: "knowledge", label: "知识", title: knowledgeVisible ? "隐藏知识上下文" : "显示知识上下文", icon: "knowledge", pressed: knowledgeVisible, onClick: onToggleKnowledge },
    { id: "focus", label: "定位", title: "定位当前路线节点", icon: "focus", onClick: onFocusActive },
    { id: "search", label: "搜索", title: "聚焦搜索框", icon: "search", onClick: onFocusSearch },
  ];

  return (
    <nav
      aria-label="工作台模式"
      className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-border-subtle bg-surface px-2 py-3"
    >
      {actions.map((action) => {
        const isActive = action.pressed === true;
        return (
          <button
            key={action.id}
            type="button"
            aria-label={action.label}
            aria-pressed={action.id === "focus" || action.id === "search" ? undefined : isActive}
            title={action.title}
            onClick={action.onClick}
            className={`flex h-11 w-11 items-center justify-center rounded-md border transition-colors ${
              isActive
                ? "border-accent/55 bg-accent/15 text-accent shadow-sm shadow-accent/10"
                : "border-transparent text-text-muted hover:border-border-medium hover:bg-elevated hover:text-text-primary"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
          >
            <ModeIcon icon={action.icon} />
          </button>
        );
      })}
    </nav>
  );
}
