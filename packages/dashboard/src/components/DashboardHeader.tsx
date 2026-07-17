import type { RefObject } from "react";
import { ThemePicker } from "./ThemePicker";

export interface DashboardHeaderProps {
  projectName: string;
  activeSurface: "wiki" | "graph";
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  themeInert: boolean;
  onSelectSurface: (surface: "wiki" | "graph") => void;
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
  return (
    <header className="uc-global-header">
      <h1 className="uc-global-header-project" title={projectName}>{projectName}</h1>
      <details className="uc-mobile-header-more" inert={themeInert || undefined}>
        <summary aria-label="更多项目与搜索信息">更多</summary>
        <section className="uc-mobile-header-more-panel" aria-label="项目与搜索信息">
          <strong title={projectName}>{projectName}</strong>
          <span>搜索快捷键：⌘K / 控制键+K</span>
        </section>
      </details>
      <nav aria-label="主要界面" className="uc-surface-switcher">
        {(["wiki", "graph"] as const).map((surface) => (
          <button
            key={surface}
            type="button"
            aria-current={activeSurface === surface ? "page" : undefined}
            onClick={() => onSelectSurface(surface)}
          >
            {surface === "wiki" ? "知识库" : "关系图谱"}
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
          <ThemePicker />
        </div>
      </div>
    </header>
  );
}
