#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourceRoot = resolve(dashboardRoot, "src");
const extensions = [".ts", ".tsx", ".js", ".jsx"];

export const FORBIDDEN_ACTIVE_SURFACE_PATHS = Object.freeze([
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
]);

function normalizedRelative(root, file) {
  return relative(root, file).replaceAll("\\", "/");
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0] ?? specifier;
  const base = resolve(dirname(fromFile), cleanSpecifier);
  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) =>
    existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function importedSpecifiers(source) {
  const specifiers = [];
  const staticPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gu;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const match of source.matchAll(staticPattern)) specifiers.push(match[1]);
  for (const match of source.matchAll(dynamicPattern)) specifiers.push(match[1]);
  return specifiers.filter((specifier) => typeof specifier === "string");
}

export function collectReachableFiles({ sourceRoot, entry }) {
  const reachable = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    if (!existsSync(current) || !statSync(current).isFile()) {
      throw new Error(`Active surface entry or import is missing: ${current}`);
    }
    reachable.add(current);
    const source = readFileSync(current, "utf8");
    for (const specifier of importedSpecifiers(source)) {
      const imported = resolveImport(current, specifier);
      if (imported && !reachable.has(imported)) queue.push(imported);
    }
  }
  return [...reachable]
    .map((file) => normalizedRelative(sourceRoot, file))
    .sort();
}

export function auditActiveSurface({ sourceRoot, entry }) {
  const reachable = collectReachableFiles({ sourceRoot, entry });
  const forbidden = new Set(FORBIDDEN_ACTIVE_SURFACE_PATHS);
  return {
    entry: sourceRoot === defaultSourceRoot
      ? normalizedRelative(dashboardRoot, entry)
      : normalizedRelative(sourceRoot, entry),
    reachable,
    forbiddenPaths: [...FORBIDDEN_ACTIVE_SURFACE_PATHS],
    forbiddenReachable: reachable.filter((file) => forbidden.has(file)),
  };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function runCli(args) {
  const sourceRootValue = argumentValue(args, "--source-root");
  const sourceRoot = sourceRootValue ? resolve(sourceRootValue) : defaultSourceRoot;
  const entryValue = argumentValue(args, "--entry");
  const entry = entryValue ? resolve(sourceRoot, entryValue) : resolve(sourceRoot, "main.tsx");
  const result = auditActiveSurface({ sourceRoot, entry });

  if (args.includes("--json")) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`${result.reachable.join("\n")}\n`);
  if (result.forbiddenReachable.length > 0) {
    process.stderr.write(
      `Removed surfaces are reachable: ${result.forbiddenReachable.join(", ")}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2));
}
