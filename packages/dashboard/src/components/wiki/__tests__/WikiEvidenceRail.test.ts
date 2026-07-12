import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WikiEvidenceV2 } from "@understand-code/core/knowledge-base";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import WikiEvidenceRail from "../WikiEvidenceRail";
import { buildKnowledgeConsoleView } from "../knowledgeConsoleModel";

interface TestElementProps {
  children?: ReactNode;
  onClick?: () => void;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (!isValidElement<TestElementProps>(node)) return "";
  return textContent(node.props.children);
}

function buttonsIn(node: ReactNode): ReactElement<TestElementProps>[] {
  if (
    node === null
    || node === undefined
    || typeof node === "string"
    || typeof node === "number"
    || typeof node === "boolean"
  ) return [];
  if (!isValidElement<TestElementProps>(node)) {
    return Children.toArray(node).flatMap(buttonsIn);
  }
  if (typeof node.type === "function") {
    return buttonsIn((node.type as (props: TestElementProps) => ReactNode)(node.props));
  }
  const nested = Children.toArray(node.props.children).flatMap(buttonsIn);
  return node.type === "button" ? [node, ...nested] : nested;
}

function renderFixture(overrides: Partial<Parameters<typeof WikiEvidenceRail>[0]> = {}) {
  const view = buildKnowledgeConsoleView(
    buildWikiRuntimeIndex(wikiV2Fixture()),
    "page:run",
  );
  if (!view.activePage) throw new Error("missing fixture page");
  const props: Parameters<typeof WikiEvidenceRail>[0] = {
    page: view.activePage,
    directPages: view.directPages,
    contextPages: view.contextPages,
    evidence: view.exactEvidence,
    directGraphNodeIds: view.directGraphNodeIds,
    headings: [],
    onOpenPage: vi.fn(),
    onOpenGraph: vi.fn(),
    ...overrides,
  };
  return { props, view };
}

describe("WikiEvidenceRail", () => {
  it("separates direct pages, context pages, and node-specific evidence", () => {
    const { props } = renderFixture();
    expect(props.directPages.map((page) => page.id)).toEqual(["page:file-a"]);
    expect(props.contextPages.map((page) => page.id)).toEqual(["page:overview"]);
    expect(props.evidence.map((item) => item.id)).toEqual(["evidence:run"]);
    const html = renderToStaticMarkup(createElement(WikiEvidenceRail, props));

    const directStart = html.indexOf("直接讲解");
    const contextStart = html.indexOf("相关资料");
    const evidenceStart = html.indexOf("源码证据");
    expect(directStart).toBeGreaterThanOrEqual(0);
    expect(directStart).toBeLessThan(contextStart);
    expect(contextStart).toBeLessThan(evidenceStart);

    const directSection = html.slice(directStart, contextStart);
    const contextSection = html.slice(contextStart, evidenceStart);
    const evidenceSection = html.slice(evidenceStart);
    expect(directSection).toContain("a.ts 文件参考");
    expect(directSection).not.toContain("项目总览");
    expect(contextSection).toContain("项目总览");
    expect(contextSection).not.toContain("a.ts 文件参考");
    expect(evidenceSection).toContain("src/a.ts");
    expect(evidenceSection).toContain("第 1–3 行");
    expect(evidenceSection).toContain("export function run() {}");
    expect(evidenceSection).toContain("生产代码");
    expect(evidenceSection).not.toContain("src/config.ts");
    expect(evidenceSection).toContain("<details");
    expect(evidenceSection).not.toContain("<details open");
  });

  it("opens the exact page represented by each page row", () => {
    const onOpenPage = vi.fn();
    const { props } = renderFixture({ onOpenPage });
    const tree = WikiEvidenceRail(props);
    const buttons = buttonsIn(tree);

    buttons.find((button) => textContent(button.props.children).includes("a.ts 文件参考"))
      ?.props.onClick?.();
    buttons.find((button) => textContent(button.props.children).includes("项目总览"))
      ?.props.onClick?.();

    expect(onOpenPage.mock.calls).toEqual([["page:file-a"], ["page:overview"]]);
  });

  it("keeps the article outline available in the evidence rail", () => {
    const { props } = renderFixture({
      headings: [
        { id: "run-rule", text: "运行规则", level: 2 },
        { id: "run-detail", text: "实现细节", level: 3 },
      ],
    });

    const html = renderToStaticMarkup(createElement(WikiEvidenceRail, props));

    expect(html).toContain('aria-label="本文目录"');
    expect(html).toContain("运行规则");
    expect(html).toContain("实现细节");
  });

  it("labels every evidence type in Chinese and falls back when excerpts are absent", () => {
    const evidence: WikiEvidenceV2[] = [
      {
        id: "evidence:production",
        nodeIds: ["function:src/a.ts:run"],
        filePath: "src/a.ts",
        lineRange: [1, 1],
        evidenceType: "production",
      },
      {
        id: "evidence:configuration",
        nodeIds: ["config:app"],
        filePath: "config/app.ts",
        lineRange: [2, 3],
        excerpt: "export const timeout = 1000;",
        evidenceType: "configuration",
      },
      {
        id: "evidence:test",
        nodeIds: ["test:run"],
        filePath: "src/a.test.ts",
        lineRange: [4, 5],
        excerpt: "expect(run()).toBeDefined();",
        evidenceType: "test",
      },
      {
        id: "evidence:documentation",
        nodeIds: ["doc:run"],
        filePath: "README.md",
        lineRange: [6, 8],
        excerpt: "运行说明",
        evidenceType: "documentation",
      },
    ];
    const { props } = renderFixture({ evidence });

    const html = renderToStaticMarkup(createElement(WikiEvidenceRail, props));

    expect(html).toContain("第 1 行");
    expect(html).toContain("未提供代码片段");
    expect(html).toContain("生产代码");
    expect(html).toContain("配置");
    expect(html).toContain("测试");
    expect(html).toContain("文档");
  });
});
