import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoots: string[] = [];

const EXPECTED_FORBIDDEN_PATHS = [
  "components/Breadcrumb.tsx",
  "components/CodeViewer.tsx",
  "components/ContainerNode.tsx",
  "components/CustomNode.tsx",
  "components/DiffToggle.tsx",
  "components/DomainClusterNode.tsx",
  "components/DomainGraphView.tsx",
  "components/ExportMenu.tsx",
  "components/FileExplorer.tsx",
  "components/FilterPanel.tsx",
  "components/FlowNode.tsx",
  "components/FunctionDetailPage.tsx",
  "components/FunctionMatrixPanel.tsx",
  "components/GraphView.tsx",
  "components/KeyboardShortcutsHelp.tsx",
  "components/KnowledgeGraphView.tsx",
  "components/LayerClusterNode.tsx",
  "components/LayerFileGraph.tsx",
  "components/LayerFileGraphNode.tsx",
  "components/LayerFileHeatmap.tsx",
  "components/LayerLegend.tsx",
  "components/LayerOverviewPanel.tsx",
  "components/LearnPanel.tsx",
  "components/MobileBottomNav.tsx",
  "components/MobileDrawer.tsx",
  "components/MobileLayout.tsx",
  "components/NodeInfo.tsx",
  "components/NodeTooltip.tsx",
  "components/OnboardingOverlay.tsx",
  "components/PathFinderModal.tsx",
  "components/PersonaSelector.tsx",
  "components/PortalNode.tsx",
  "components/ProjectOverview.tsx",
  "components/ReadableViewGraphPage.tsx",
  "components/ReadingAssistantPanel.tsx",
  "components/SearchBar.tsx",
  "components/StepNode.tsx",
  "components/ViewGraphBreadcrumb.tsx",
  "components/nodeDisplayLabels.ts",
  "components/readingAssistantModel.ts",
  "components/readingRoute.ts",
  "components/workbench/JourneyRail.tsx",
  "components/workbench/KnowledgeContextPanel.tsx",
  "components/workbench/ModeRail.tsx",
  "components/workbench/VisualGuidedWorkbench.tsx",
  "components/workbench/VisualStage.tsx",
  "contexts/I18nContext.tsx",
  "locales/en.ts",
  "locales/index.ts",
  "locales/ja.ts",
  "locales/ko.ts",
  "locales/ru.ts",
  "locales/zh-TW.ts",
  "locales/zh.ts",
  "utils/containers.ts",
  "utils/edgeAggregation.ts",
  "utils/filters.ts",
  "utils/layerStats.ts",
  "utils/louvain.ts",
  "utils/viewModeControls.ts",
  "viewgraph/buildViewGraph.ts",
  "viewgraph/fileRelationships.ts",
  "viewgraph/functionGrouping.ts",
  "viewgraph/functionImpact.ts",
  "viewgraph/layerFileGraphModel.ts",
  "viewgraph/readableSelectors.ts",
  "viewgraph/types.ts",
  "workbench/journeyRoute.ts",
  "workbench/knowledgeContext.ts",
] as const;

interface AuditResult {
  entry: string;
  reachable: string[];
  forbiddenPaths: string[];
  forbiddenReachable: string[];
}

function runActiveAudit(): AuditResult {
  const stdout = execFileSync("node", ["scripts/audit-active-surface.mjs", "--json"], {
    cwd: dashboardRoot,
    encoding: "utf8",
  });
  return JSON.parse(stdout) as AuditResult;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("active dashboard surface", () => {
  it("reaches both active surfaces without reaching an inherited toolbench", () => {
    const result = runActiveAudit();

    expect(result.entry).toBe("src/main.tsx");
    expect(result.forbiddenReachable).toEqual([]);
    expect(result.reachable).toContain("components/wiki/KnowledgeConsole.tsx");
    expect(result.reachable).toContain("components/graphExplorer/GraphExplorer.tsx");
    expect(result.reachable).toEqual([...result.reachable].sort());
  });

  it("freezes every production path removed by the Wiki/Graph migration", () => {
    const result = runActiveAudit();

    expect(result.forbiddenPaths).toHaveLength(69);
    expect(result.forbiddenPaths).toEqual(EXPECTED_FORBIDDEN_PATHS);
    expect(new Set(result.forbiddenPaths).size).toBe(result.forbiddenPaths.length);
  });

  it("detects a forbidden file through static import, export, and dynamic import traversal", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "active-surface-audit-"));
    temporaryRoots.push(fixtureRoot);
    const sourceRoot = join(fixtureRoot, "src");
    mkdirSync(join(sourceRoot, "components"), { recursive: true });
    writeFileSync(
      join(sourceRoot, "main.tsx"),
      'import "./App";\nexport { exported } from "./exported";\nvoid import("./lazy");\n',
    );
    writeFileSync(join(sourceRoot, "App.tsx"), 'import "./components/GraphView";\n');
    writeFileSync(join(sourceRoot, "components/GraphView.tsx"), "export const graph = true;\n");
    writeFileSync(join(sourceRoot, "exported.ts"), "export const exported = true;\n");
    writeFileSync(join(sourceRoot, "lazy.ts"), "export const lazy = true;\n");

    const completed = spawnSync(
      "node",
      ["scripts/audit-active-surface.mjs", "--json", "--source-root", sourceRoot],
      { cwd: dashboardRoot, encoding: "utf8" },
    );
    const result = JSON.parse(completed.stdout) as AuditResult;

    expect(completed.status).toBe(1);
    expect(result.reachable).toEqual([
      "App.tsx",
      "components/GraphView.tsx",
      "exported.ts",
      "lazy.ts",
      "main.tsx",
    ]);
    expect(result.forbiddenReachable).toEqual(["components/GraphView.tsx"]);
    expect(completed.stderr).toContain("components/GraphView.tsx");
  });

  it("does not import a removed shell from the application entry", () => {
    const source = readFileSync(join(dashboardRoot, "src/App.tsx"), "utf8");
    for (const moduleName of [
      "MobileLayout",
      "VisualGuidedWorkbench",
      "GraphView",
      "DomainGraphView",
      "KnowledgeGraphView",
    ]) {
      expect(source).not.toMatch(new RegExp(`from ["'][^"']*${moduleName}`));
    }
  });
});
