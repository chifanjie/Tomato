import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = join(dashboardRoot, "src");

interface ActiveSurfaceAudit {
  reachable: string[];
  forbiddenReachable: string[];
}

const audit = JSON.parse(execFileSync(
  "node",
  ["scripts/audit-active-surface.mjs", "--json"],
  { cwd: dashboardRoot, encoding: "utf8" },
)) as ActiveSurfaceAudit;

const activeTypeScriptFiles = audit.reachable.filter((file) => /\.(?:ts|tsx)$/u.test(file));
const sources = new Map(activeTypeScriptFiles.map((file) => [
  file,
  readFileSync(join(sourceRoot, file), "utf8"),
]));

const REQUIRED_LANGUAGE_SURFACES = [
  "components/TokenGate.tsx",
  "components/WarningBanner.tsx",
  "components/ThemePicker.tsx",
  "themes/presets.ts",
  "components/wiki/GuidedWikiHome.tsx",
  "components/wiki/GlobalWikiSearch.tsx",
  "components/wiki/WikiResponsiveShell.tsx",
  "components/graphExplorer/GraphExplorer.tsx",
  "components/graphExplorer/GraphDetailsRail.tsx",
  "components/graphExplorer/SemanticGraphCanvas.tsx",
  "components/graphExplorer/graphExplorerModel.ts",
  "components/graphExplorer/semanticGraphCanvasModel.ts",
] as const;

const FORBIDDEN_ENGLISH_PRODUCT_COPY = [
  "Quick Jump",
  "Main Reading",
  "Code Reference",
  "Coverage",
  "Architecture",
  "Call Graph",
  "Open Wiki",
  "Access Token Required",
  "Paste the access token",
  "Paste token here",
  "Invalid token",
  "Unexpected response",
  "Could not reach the server",
  "Validating...",
  "Some of these issues look like dashboard rendering bugs",
  "The following issues were found",
  "click to collapse",
  "click to expand",
  "Auto-corrected",
  "Dropped",
  "Fatal",
  "Copy Issues",
  "Copied!",
  "Engineering Workbench",
  "Technical Document",
] as const;

const SURFACE_PROPERTY_NAMES = new Set([
  "description",
  "emptyText",
  "label",
  "name",
  "placeholder",
  "title",
]);
const USER_COPY_ATTRIBUTES = new Set(["alt", "aria-label", "placeholder", "title"]);
const TECHNICAL_TOKEN_ALLOWLIST = new Set([
  "Esc",
  "GitHub",
  "ID",
  "JSON",
  "K",
  "V2",
  "Wiki",
  "graph",
  "index",
  "json",
  "knowledge",
  // Slash-command names the user must type verbatim to recover.
  "understand",
  "wiki",
]);
const TRADITIONAL_COPY = /[這個裡為於與後臺資檔圖譜關開載點擊錯誤頁總證說體項數態庫動擇劃讀寫網絡線節]/u;

function propertyName(node: ts.PropertyName): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

function literalFragments(node: ts.Node): string[] {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
  }
  return [];
}

function normalizeCopy(value: string): string {
  return value.replace(/&#x?[0-9A-Fa-f]+;/gu, "").replace(/\s+/gu, " ").trim();
}

function unexpectedEnglishTokens(copy: string): string[] {
  return copy.match(/[A-Za-z][A-Za-z0-9]*/gu)
    ?.filter((token) => !TECHNICAL_TOKEN_ALLOWLIST.has(token)) ?? [];
}

function renderedJsxExpression(node: ts.Node): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isJsxExpression(parent)) return !ts.isJsxAttribute(parent.parent);
    if (
      ts.isParenthesizedExpression(parent)
      || ts.isAsExpression(parent)
      || ts.isNonNullExpression(parent)
    ) {
      current = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent)) {
      if (current === parent.condition) return false;
      current = parent;
      continue;
    }
    return false;
  }
  return false;
}

function collectUserFacingLiterals(file: string, source: string): string[] {
  const syntax = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, syntax);
  const copies: string[] = [];
  const renderedIdentifiers = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeCopy(value);
    if (normalized) copies.push(normalized);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxExpression(node)
      && node.expression
      && ts.isIdentifier(node.expression)
      && !ts.isJsxAttribute(node.parent)
    ) renderedIdentifiers.add(node.expression.text);
    if (ts.isJsxText(node)) add(node.text);
    if (
      ts.isJsxAttribute(node)
      && USER_COPY_ATTRIBUTES.has(node.name.getText(root))
      && node.initializer
      && ts.isStringLiteral(node.initializer)
    ) add(node.initializer.text);
    if (
      ts.isJsxAttribute(node)
      && USER_COPY_ATTRIBUTES.has(node.name.getText(root))
      && node.initializer
      && ts.isJsxExpression(node.initializer)
      && node.initializer.expression
    ) {
      for (const fragment of literalFragments(node.initializer.expression)) add(fragment);
    }
    if (
      ts.isPropertyAssignment(node)
      && SURFACE_PROPERTY_NAMES.has(propertyName(node.name) ?? "")
    ) {
      for (const fragment of literalFragments(node.initializer)) add(fragment);
    }
    if (
      (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))
      && renderedJsxExpression(node)
    ) {
      for (const fragment of literalFragments(node)) add(fragment);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  const collectRenderedDeclarations = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && renderedIdentifiers.has(node.name.text)
      && node.initializer
    ) {
      const collectInitializer = (value: ts.Node) => {
        for (const fragment of literalFragments(value)) add(fragment);
        ts.forEachChild(value, collectInitializer);
      };
      collectInitializer(node.initializer);
    }
    ts.forEachChild(node, collectRenderedDeclarations);
  };
  collectRenderedDeclarations(root);
  return [...new Set(copies)];
}

describe("简体中文活动界面门禁", () => {
  it("从真实入口审计全部可达界面，并覆盖 Wiki、Graph、鉴权、警告与主题模型", () => {
    expect(audit.forbiddenReachable).toEqual([]);
    for (const file of REQUIRED_LANGUAGE_SURFACES) {
      expect(activeTypeScriptFiles, `${file} 必须由 main.tsx 活动入口可达`).toContain(file);
    }
    expect(activeTypeScriptFiles.filter((file) => file.startsWith("components/wiki/"))).not.toHaveLength(0);
    expect(activeTypeScriptFiles.filter((file) => file.startsWith("components/graphExplorer/"))).not.toHaveLength(0);
  });

  it("不再出现旧版或遗留英文产品文案", () => {
    const userCopy = [...sources].flatMap(([file, source]) =>
      collectUserFacingLiterals(file, source).map((copy) => ({ file, copy })));
    for (const copy of FORBIDDEN_ENGLISH_PRODUCT_COPY) {
      expect(
        userCopy.filter((value) => value.copy.includes(copy)),
        `活动界面仍含英文产品文案：${copy}`,
      ).toEqual([]);
    }
  });

  it("用户可见的静态文案不是纯英文，也不含繁体词形", () => {
    const violations: string[] = [];
    for (const [file, source] of sources) {
      for (const copy of collectUserFacingLiterals(file, source)) {
        if (TRADITIONAL_COPY.test(copy)) violations.push(`${file}: 繁体词形「${copy}」`);
        const unexpectedTokens = unexpectedEnglishTokens(copy);
        if (unexpectedTokens.length > 0) {
          violations.push(`${file}: 未放行英文词 ${unexpectedTokens.join("、")}「${copy}」`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("混合中文文案仍会拦截英文产品词，只放行明确的技术标识", () => {
    expect(unexpectedEnglishTokens("无法连接服务器：Failed to fetch")).toEqual([
      "Failed",
      "to",
      "fetch",
    ]);
    expect(unexpectedEnglishTokens("按 Esc 关闭，在 GitHub 查看 knowledge-graph.json")).toEqual([]);

    const templateFixture = `
      export function Example({ detail }: { detail: string }) {
        const copy = \`中文提示：\${detail} Failed to fetch\`;
        return <p>{copy}</p>;
      }
    `;
    const fixtureTokens = collectUserFacingLiterals("Example.tsx", templateFixture)
      .flatMap(unexpectedEnglishTokens);
    expect(fixtureTokens).toEqual(["Failed", "to", "fetch"]);
  });

  it("活动界面不会把原始异常详情写入可见状态", () => {
    const violations = [...sources].flatMap(([file, source]) => {
      const rawErrorState = [
        /set[A-Za-z]*Error\([^\n]*(?:error|err)\.message/gu,
        /set[A-Za-z]*Error\([^\n]*String\((?:error|err)\)/gu,
        /error\s*:\s*(?:error|err)\s+instanceof\s+Error\s*\?\s*(?:error|err)\.message/gu,
      ];
      return rawErrorState.flatMap((pattern) =>
        [...source.matchAll(pattern)].map((match) => `${file}: ${match[0]}`));
    });
    expect(violations).toEqual([]);
  });
});
