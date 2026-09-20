// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardStore } from "../../../store";
import { buildWikiRuntimeIndex } from "../../../wiki/wikiIndex";
import { wikiV2Fixture } from "../../../wiki/__tests__/fixtures/wikiV2Fixtures";
import { WikiResourceLink } from "../WikiResourceLink";
import { WikiMarkdownDocument } from "../WikiPageView";
import type { WikiTarget } from "../../../wiki/wikiContent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  useDashboardStore.setState(useDashboardStore.getInitialState());
  vi.restoreAllMocks();
});

async function mount(href: string, onSelectTarget: (target: WikiTarget) => void = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(createElement("p", {}, createElement(WikiResourceLink, {
    href, children: "入口", currentMarkdownPath: "knowledge-base/目录.md",
    pageIdByMarkdownPath: new Map([["knowledge-base/总览.md", "overview"]]),
    repositoryRoot: "/repo", onSelectTarget,
  }))));
  return container;
}

describe("WikiResourceLink", () => {
  it("opens unavailable resource details without navigating away and supports path copying", async () => {
    const container = await mount("/repo/docs/wiki/图谱.drawio");
    expect(container.querySelector("a")).toBeNull();
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("当前知识库未收录此资源");
    expect(container.textContent).toContain("/repo/docs/wiki/图谱.drawio");
    expect(container.querySelector("p > span [role=region]")).not.toBeNull();
    expect(container.querySelector("p div, p pre")).toBeNull();
    const copy = [...container.querySelectorAll("button")].find(button => button.textContent === "复制路径")!;
    await act(async () => copy.click());
    expect(await navigator.clipboard.readText()).toBe("/repo/docs/wiki/图谱.drawio");
    expect(container.textContent).toContain("已复制");
  });

  it("shows indexed source lines and highlights the requested line", async () => {
    const payload = wikiV2Fixture();
    payload.evidence = [{ id: "source", nodeIds: [], filePath: "server/index.ts", lineRange: [40, 44], evidenceType: "production", excerpt: "forty\nforty-one\ntarget\nforty-three\nforty-four" }];
    useDashboardStore.setState({ wikiIndex: buildWikiRuntimeIndex(payload) });
    const container = await mount("/repo/server/index.ts:42");
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("server/index.ts");
    expect(container.querySelector('[data-highlighted="true"]')?.textContent).toContain("42");
    expect(container.querySelector('[data-highlighted="true"]')?.textContent).toContain("target");
    expect(container.querySelector("a")).toBeNull();
    await act(async () => container.querySelector('[role="region"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it("displays and copies readable Chinese resource paths received as encoded Markdown hrefs", async () => {
    const container = await mount("/repo/docs/wiki/%E9%A1%B9%E7%9B%AE%E5%9B%BE%E8%B0%B1.md");
    expect(container.querySelector("button")?.title).toBe("/repo/docs/wiki/项目图谱.md");
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector(".uc-resource-path")?.textContent).toBe("/repo/docs/wiki/项目图谱.md");
    const copy = [...container.querySelectorAll("button")].find(button => button.textContent === "复制路径")!;
    await act(async () => copy.click());
    expect(await navigator.clipboard.readText()).toBe("/repo/docs/wiki/项目图谱.md");
  });

  it("retains a malformed encoded resource path without breaking the article", async () => {
    const container = await mount("/repo/docs/wiki/%E0%A4%A.md");
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector(".uc-resource-path")?.textContent).toBe("/repo/docs/wiki/%E0%A4%A.md");
  });

  it("renders a Markdown link with a code path label without nesting interactive controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root!.render(createElement(WikiMarkdownDocument, {
      markdown: "代码根目录：/repo\n\n[`server/src/index.ts`](/repo/server/src/index.ts:42)",
      currentMarkdownPath: "knowledge-base/目录.md",
      pageIdByMarkdownPath: new Map(), headings: [], onSelectTarget: vi.fn(),
    })));
    const link = container.querySelector<HTMLButtonElement>(".uc-resource-link")!;
    expect(link.textContent).toContain("server/src/index.ts");
    expect(link.querySelector("button, a")).toBeNull();
    await act(async () => link.click());
    expect(container.textContent).toContain("当前知识库未收录此资源");
  });

  it("preserves local file-and-line hrefs through Markdown URL normalization", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root!.render(createElement(WikiMarkdownDocument, {
      markdown: "[说明](README.md:2) 和 [入口](C:/repo/src/index.ts:2)",
      currentMarkdownPath: "knowledge-base/目录.md", pageIdByMarkdownPath: new Map(),
      headings: [], onSelectTarget: vi.fn(),
    })));
    expect([...container.querySelectorAll<HTMLButtonElement>(".uc-resource-link")].map(button => button.title))
      .toEqual(["README.md:2", "C:/repo/src/index.ts:2"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("uses a reference page's exact evidence binding to open its authored source path", async () => {
    const payload = wikiV2Fixture();
    const page = payload.pages[0]!;
    page.category = "file";
    page.markdownPath = "knowledge-base/源码参考/client__src__App.tsx.md";
    page.evidenceIds = ["app-source"];
    payload.source.sourceRootIdentity = "root-opaque-published-snapshot";
    payload.evidence = [
      { id: "app-source", nodeIds: [], filePath: "client/src/App.tsx", lineRange: [1, 2], evidenceType: "production", excerpt: "const app = true;\nexport default app;" },
      { id: "unrelated", nodeIds: [], filePath: "server/src/App.tsx", lineRange: [1, 1], evidenceType: "production", excerpt: "unrelated" },
    ];
    useDashboardStore.setState({ wikiIndex: buildWikiRuntimeIndex(payload) });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root!.render(createElement(WikiMarkdownDocument, {
      markdown: "## 源码位置\n[查看源文件](/author/project/client/src/App.tsx:1)。下方是完整源码。",
      currentMarkdownPath: page.markdownPath, pageIdByMarkdownPath: new Map(),
      headings: [], onSelectTarget: vi.fn(),
    })));
    await act(async () => container.querySelector<HTMLButtonElement>(".uc-resource-link")!.click());
    expect(container.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("源码预览");
    expect(container.querySelector(".uc-resource-code")?.textContent).toContain("const app = true;");
    expect(container.textContent).not.toContain("unrelated");
  });

  it("does not preserve executable URL schemes when allowing local resource paths", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root!.render(createElement(WikiMarkdownDocument, {
      markdown: "[脚本](javascript:evil) [嵌入](data:text/html,test)",
      currentMarkdownPath: "knowledge-base/目录.md", pageIdByMarkdownPath: new Map(),
      headings: [], onSelectTarget: vi.fn(),
    })));
    expect(container.textContent).toContain("脚本");
    expect(container.querySelector("a[href], script, iframe")).toBeNull();
  });

  it("keeps canonical wiki navigation and external link behavior", async () => {
    let selected = "";
    const container = await mount("总览.md", (target: { pageId: string }) => { selected = target.pageId; });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#wiki=overview");
    await act(async () => container.querySelector("a")!.click());
    expect(selected).toBe("overview");
  });

  it("closes resource details when the article changes", async () => {
    const container = await mount("/repo/old.drawio");
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector('[role="region"]')).not.toBeNull();
    await act(async () => root!.render(createElement("p", {}, createElement(WikiResourceLink, {
      href: "/repo/new.drawio", children: "入口", currentMarkdownPath: "knowledge-base/第二篇.md",
      pageIdByMarkdownPath: new Map(), repositoryRoot: "/repo", onSelectTarget: vi.fn(),
    }))));
    expect(container.querySelector('[role="region"]')).toBeNull();
  });
});
