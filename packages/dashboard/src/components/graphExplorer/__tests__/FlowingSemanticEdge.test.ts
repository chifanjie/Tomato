import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Position } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    BaseEdge: ({ path, style }: { path: string; style?: React.CSSProperties }) =>
      React.createElement("path", { d: path, style, "data-base-edge": "true" }),
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-edge-label-renderer": "true" }, children),
    getSmoothStepPath: () => ["M0 0 L10 0", 5, 0],
    Position: { Bottom: "bottom", Top: "top" },
  };
});

import FlowingSemanticEdge, {
  edgeDirectionCopy,
  type FlowingSemanticEdgeData,
} from "../FlowingSemanticEdge";

function edgeHtml(overrides: Partial<FlowingSemanticEdgeData> = {}, label: string | undefined = "调用") {
  return renderToStaticMarkup(createElement(FlowingSemanticEdge, {
    id: "edge:a-b",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 10,
    targetY: 0,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    label,
    data: {
      stroke: "#0aa",
      opacity: 1,
      strokeWidth: 2.6,
      animated: false,
      inlineDirection: false,
      flowDirection: "forward",
      dashedFallback: false,
      showLabel: false,
      labelOpacity: 1,
      sourceLabel: "源服务",
      targetLabel: "目标服务",
      ...overrides,
    },
  }));
}

describe("FlowingSemanticEdge", () => {
  it("shows relationship labels only for selected or hovered relationships", () => {
    expect(edgeHtml({ showLabel: false })).not.toContain("调用");
    expect(edgeHtml({ showLabel: true })).toContain("调用");
    expect(edgeHtml({ showLabel: true })).toContain("uc-semantic-edge-label");
  });

  it("keeps a hovered label readable even when its edge path is dimmed", () => {
    const html = edgeHtml({ showLabel: true, opacity: 0.1, labelOpacity: 0.94 });
    expect(html).toContain("opacity:0.94");
  });

  it.each([
    ["forward", "从「源服务」到「目标服务」"],
    ["reverse", "从「目标服务」到「源服务」"],
    ["both", "「源服务」与「目标服务」双向"],
  ] as const)("renders a Chinese %s midpoint direction without an arrow glyph", (flowDirection, copy) => {
    const html = edgeHtml({ inlineDirection: true, flowDirection });
    expect(html).toContain("uc-semantic-edge-direction");
    expect(html).toContain(copy);
    expect(html).toContain(`aria-label="${copy}"`);
    expect(html).not.toMatch(/[›↔→←]/u);
    expect(html).not.toMatch(/marker(?:End|-end)/u);
  });

  it("clamps endpoint text visually while preserving the full accessible direction", () => {
    const sourceLabel = "这是一个超过十个字符的源服务名称";
    const targetLabel = "这是另一个超过十个字符的目标服务名称";
    const copy = edgeDirectionCopy(sourceLabel, targetLabel, "forward");
    const html = edgeHtml({ inlineDirection: true, sourceLabel, targetLabel });

    expect(copy.visible).toBe("从「这是一个超过十个字符…」到「这是另一个超过十个字…」");
    expect(copy.ariaLabel).toBe(`从「${sourceLabel}」到「${targetLabel}」`);
    expect(html).toContain(copy.visible);
    expect(html).toContain(`aria-label="${copy.ariaLabel}"`);
  });

  it("keeps forward and reverse overlays but never renders a terminal marker", () => {
    const source = readFileSync(new URL("../FlowingSemanticEdge.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("markerEnd");
    expect(source).toContain("uc-edge-flow-forward");
    expect(source).toContain("uc-edge-flow-reverse");
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain('animationDelay: "-.425s"');
    expect(source).not.toContain("directionIndicator");
  });

  it("renders the BaseEdge without a terminal marker", () => {
    const html = edgeHtml({ showLabel: true, animated: true });
    expect(html).toContain('data-base-edge="true"');
    expect(html).toContain("uc-edge-flow-forward");
    expect(html).not.toMatch(/marker(?:End|-end)/u);
  });
});
