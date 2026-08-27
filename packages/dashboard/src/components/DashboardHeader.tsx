import { useEffect, useRef, type RefObject } from "react";
import { ThemePicker } from "./ThemePicker";

export type ProductSurface = "tasks" | "wiki" | "graph";

export interface DashboardHeaderProps {
  projectName: string;
  activeSurface: ProductSurface;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  themeInert: boolean;
  onSelectSurface: (surface: ProductSurface) => void;
  onRequestSearch: () => void;
}

export default function DashboardHeader({
  projectName,
  activeSurface,
  searchButtonRef,
  themeInert,
  onSelectSurface,
  onRequestSearch,
}: DashboardHeaderProps) {
  const mobileMoreRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (themeInert && mobileMoreRef.current) mobileMoreRef.current.open = false;
  }, [themeInert]);

  return (
    <header className="uc-global-header">
      <h1 className="uc-global-header-project" title={projectName}>{projectName}</h1>
      <details ref={mobileMoreRef} className="uc-mobile-header-more" inert={themeInert || undefined}>
        <summary aria-label="更多项目与搜索信息">更多</summary>
        <section className="uc-mobile-header-more-panel" aria-label="项目与搜索信息">
          <strong title={projectName}>{projectName}</strong>
          <span>搜索快捷键：⌘K / 控制键+K</span>
        </section>
      </details>
      <nav aria-label="主要界面" className="uc-surface-switcher">
        {(["tasks", "wiki", "graph"] as const).map((surface) => (
          <button
            key={surface}
            type="button"
            aria-current={activeSurface === surface ? "page" : undefined}
            onClick={() => onSelectSurface(surface)}
          >
            {surface === "tasks" ? "任务" : surface === "wiki" ? "知识库" : "关系图谱"}
          </button>
        ))}
      </nav>
      <div className="uc-global-header-actions">
        <button
          ref={searchButtonRef}
          type="button"
          className="uc-global-search-trigger"
          aria-label="搜索知识库"
          onClick={onRequestSearch}
        >
          <span>搜索</span><kbd aria-hidden="true">⌘K</kbd>
        </button>
        <div className="uc-theme-slot" inert={themeInert || undefined}>
          <ThemePicker disabled={themeInert} />
        </div>
      </div>
    </header>
  );
}
