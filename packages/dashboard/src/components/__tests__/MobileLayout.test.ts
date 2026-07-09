import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "../../contexts/I18nContext";
import { useDashboardStore } from "../../store";
import { ThemeProvider } from "../../themes";
import MobileLayout, { mobilePrimarySurfaceLabel } from "../MobileLayout";

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
  const mobileLayout = React.createElement(MobileLayout, {
    accessToken: "local",
    showKeyboardHelp: false,
    setShowKeyboardHelp: vi.fn(),
    loadError: null,
    allIssues: [],
    shortcuts: [],
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
  });

  it("labels the primary mobile tab for each peer surface", () => {
    expect(mobilePrimarySurfaceLabel("wiki")).toBe("Wiki");
    expect(mobilePrimarySurfaceLabel("graph")).toBe("Graph");
  });
});
