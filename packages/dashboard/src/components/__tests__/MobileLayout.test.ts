import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "../../contexts/I18nContext";
import { useDashboardStore } from "../../store";
import { ThemeProvider } from "../../themes";
import MobileLayout, {
  mobilePrimarySurfaceLabel,
  mobileSearchButtonLabel,
  shouldAutoPivotMobileInfo,
} from "../MobileLayout";

vi.mock("../wiki/KnowledgeConsole", async () => {
  const React = await import("react");
  return {
    default: () => React.createElement("section", null, "Mock mobile wiki surface"),
  };
});

vi.mock("../graphExplorer/GraphExplorer", async () => {
  const React = await import("react");
  return {
    default: () => React.createElement("section", null, "Mock mobile graph surface"),
  };
});

function renderMobileLayout(): string {
  const searchButtonRef = React.createRef<HTMLButtonElement>();
  const mobileLayout = React.createElement(MobileLayout, {
    accessToken: "local",
    showKeyboardHelp: false,
    setShowKeyboardHelp: vi.fn(),
    loadError: null,
    allIssues: [],
    shortcuts: [],
    searchButtonRef,
    onOpenGlobalSearch: vi.fn(),
  });

  return renderToString(
    React.createElement(
      I18nProvider,
      {
        language: "en",
        children: React.createElement(ThemeProvider, {
          children: mobileLayout,
        }),
      },
    ),
  );
}

describe("MobileLayout", () => {
  beforeEach(() => {
    useDashboardStore.getState().setDashboardSurface("wiki");
  });

  it("renders the wiki peer surface on mobile", () => {
    const output = renderMobileLayout();

    expect(output).toContain("Mock mobile wiki surface");
    expect(output).not.toContain("Mock mobile graph surface");
    expect(output).toContain('aria-label="搜索知识库"');
    expect(output).not.toContain('data-testid="search-input"');
  });

  it("labels the primary mobile tab for each peer surface", () => {
    expect(mobilePrimarySurfaceLabel("wiki")).toBe("Wiki");
    expect(mobilePrimarySurfaceLabel("graph")).toBe("Graph");
  });

  it("uses Simplified Chinese for global and legacy search button states", () => {
    expect(mobileSearchButtonLabel(true, false)).toBe("搜索知识库");
    expect(mobileSearchButtonLabel(false, false)).toBe("显示搜索");
    expect(mobileSearchButtonLabel(false, true)).toBe("隐藏搜索");
  });

  it("does not auto-pivot peer surfaces away from the primary mobile tab", () => {
    expect(
      shouldAutoPivotMobileInfo({
        dashboardSurface: "graph",
        selectedNodeId: "function:src/app.ts:run",
        navigationLevel: "overview",
      }),
    ).toBe(false);
    expect(
      shouldAutoPivotMobileInfo({
        dashboardSurface: "wiki",
        selectedNodeId: "function:src/app.ts:run",
        navigationLevel: "overview",
      }),
    ).toBe(false);
  });
});
