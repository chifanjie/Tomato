// @vitest-environment happy-dom

import type { GraphIssue } from "@understand-code/core/schema";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WarningBanner from "../WarningBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mountBanner(issues: GraphIssue[]): Promise<{
  container: HTMLDivElement;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(WarningBanner, { issues })));
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("WarningBanner 简体中文交互", () => {
  it("用中文汇总、展开并复制致命问题", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const issues = [
      { level: "fatal", category: "elk-layout-failed", message: "ELK worker crashed", path: "graph.layout" },
      { level: "auto-corrected", category: "missing-field", message: "missing type", path: "nodes[0].type" },
      { level: "dropped", category: "invalid-node", message: "validation failed", path: "nodes[1]" },
    ] satisfies GraphIssue[];
    const { container, root } = await mountBanner(issues);
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="graph-issue-details"]');
    if (!toggle) throw new Error("缺少问题详情开关");

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("界面遇到：1 个致命错误、1 项自动修正、1 个已忽略项");
    expect(container.textContent).toContain("点击展开");

    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#graph-issue-details")).not.toBeNull();
    expect(container.textContent).toContain("致命（1）");
    expect(container.textContent).toContain("自动修正（1）");
    expect(container.textContent).toContain("已忽略（1）");
    expect(container.textContent).toContain("图谱布局计算失败（位置：graph.layout）");
    expect(container.textContent).toContain("缺少字段，已补充默认值（位置：nodes[0].type）");
    expect(container.textContent).toContain("节点校验失败，已忽略（位置：nodes[1]）");
    expect(container.textContent).not.toContain("ELK worker crashed");
    expect(container.textContent).not.toContain("validation failed");
    expect(container.textContent).toContain("复制这些问题并在 GitHub 提交问题报告");

    const copyButton = [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("复制问题"));
    if (!copyButton) throw new Error("缺少复制问题按钮");
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("[致命] 图谱布局计算失败（位置：graph.layout）"));
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining("ELK worker crashed"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("请携带以下内容前往 github.com/Lum1104/Understand-Anything/issues 提交问题"));
    expect(container.textContent).toContain("已复制");

    await act(async () => root.unmount());
  });

  it("用中文说明可由智能体修复的生成问题", async () => {
    const { container, root } = await mountBanner([
      { level: "auto-corrected", category: "alias", message: "mapped alias", path: "nodes[0].type" },
      { level: "dropped", category: "invalid-reference", message: "source does not exist", path: "edges[0].source" },
    ]);

    expect(container.textContent).toContain("知识图谱已载入：1 项自动修正、1 个已忽略项");
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="graph-issue-details"]');
    if (!toggle) throw new Error("缺少问题详情开关");
    await act(async () => toggle.click());
    expect(container.textContent).toContain("复制这些问题，并让智能体修复 knowledge-graph.json");
    expect(container.textContent).toContain("使用了别名，已映射为标准值（位置：nodes[0].type）");
    expect(container.textContent).toContain("连接线引用不存在的节点，已忽略（位置：edges[0].source）");
    expect(container.textContent).not.toContain("source does not exist");

    await act(async () => root.unmount());
  });

  it("不直接展示未知类别携带的繁体或英文原始错误句", async () => {
    const { container, root } = await mountBanner([
      {
        level: "dropped",
        category: "custom-validator",
        message: "這個節點 validation failed",
        path: "nodes[9]",
      },
    ]);

    const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="graph-issue-details"]');
    if (!toggle) throw new Error("缺少问题详情开关");
    await act(async () => toggle.click());
    expect(container.textContent).toContain("发现未分类的知识图谱问题（位置：nodes[9]）");
    expect(container.textContent).not.toContain("custom-validator");
    expect(container.textContent).not.toContain("這個節點");
    expect(container.textContent).not.toContain("validation failed");

    await act(async () => root.unmount());
  });
});
