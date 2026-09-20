// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WikiMermaidDiagram from "../WikiMermaidDiagram";

const renderer = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: renderer }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  renderer.render.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
});

async function show(source: string) {
  await act(async () => {
    root.render(createElement(WikiMermaidDiagram, { source }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("WikiMermaidDiagram", () => {
  it("shows a labelled diagram and keeps the original source available without binding diagram actions", async () => {
    const bindFunctions = vi.fn();
    renderer.render.mockResolvedValue({ svg: '<svg><text>项目总览</text></svg>', bindFunctions });
    const source = "flowchart TD\n  A[项目总览] --> B[扫描编排]";
    await show(source);

    expect(container.querySelector('[role="img"][aria-label="文档流程图"] svg')?.textContent).toBe("项目总览");
    expect(container.querySelector("details code")?.textContent).toBe(source);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.textContent).toContain("查看图表源码");
    expect(bindFunctions).not.toHaveBeenCalled();
    expect(renderer.initialize).toHaveBeenCalledWith(expect.objectContaining({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      suppressErrorRendering: true,
      secure: expect.arrayContaining(["securityLevel", "htmlLabels", "suppressErrorRendering"]),
    }));
  });

  it("keeps the source readable when rendering fails, without displaying raw library exceptions", async () => {
    renderer.render.mockRejectedValue(new Error("parse private stack detail"));
    const source = "flowchart TD\n  invalid[";
    await show(source);

    expect(container.querySelector('[role="status"]')?.textContent).toContain("图表暂时无法渲染");
    expect(container.textContent).not.toContain("private stack detail");
    expect(container.querySelector("details")?.open).toBe(true);
    expect(container.querySelector("code")?.textContent).toBe(source);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("does not replace the current diagram with the result of an older document", async () => {
    let finishFirst: (value: { svg: string }) => void = () => {};
    renderer.render.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    await show("flowchart TD\n  OLD --> PAGE");
    renderer.render.mockResolvedValueOnce({ svg: '<svg><text>当前页面</text></svg>' });
    await show("flowchart TD\n  CURRENT --> PAGE");

    await act(async () => { finishFirst({ svg: '<svg><text>旧页面</text></svg>' }); });
    expect(container.querySelector("svg")?.textContent).toBe("当前页面");
    expect(container.textContent).not.toContain("旧页面");
  });

  it("uses the source fallback when the renderer produces empty output", async () => {
    renderer.render.mockResolvedValue({ svg: "" });
    await show("flowchart TD\n  A --> B");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("图表暂时无法渲染");
    expect(container.querySelector("details")?.open).toBe(true);
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});
