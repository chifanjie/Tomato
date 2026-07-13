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

import FlowingSemanticEdge, { directionIndicator } from "../FlowingSemanticEdge";

describe("FlowingSemanticEdge", () => {
  it("really renders the reduced-motion midpoint mark without a terminal marker", () => {
    const html = renderToStaticMarkup(createElement(FlowingSemanticEdge, {
      id: "edge:a-b",
      source: "a",
      target: "b",
      sourceX: 0,
      sourceY: 0,
      targetX: 10,
      targetY: 0,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      label: "调用",
      data: {
        stroke: "#0aa",
        opacity: 1,
        strokeWidth: 3,
        animated: false,
        inlineDirection: true,
        flowDirection: "forward",
        dashedFallback: false,
      },
    }));

    expect(html).toContain('data-base-edge="true"');
    expect(html).toContain("uc-semantic-edge-direction");
    expect(html).toContain("›");
    expect(html).not.toMatch(/marker(?:End|-end)/u);
    expect(html).not.toContain("uc-edge-flow-forward");
  });

  it("derives an inline direction glyph without terminal arrows", () => {
    expect(directionIndicator(0, 0, 10, 0, "forward")).toEqual({ glyph: "›", angle: 0 });
    expect(directionIndicator(0, 0, 10, 0, "reverse")).toEqual({ glyph: "›", angle: 180 });
    expect(directionIndicator(0, 0, 10, 0, "both")).toEqual({ glyph: "↔", angle: 0 });
  });

  it("keeps forward and reverse overlays but never renders a terminal marker", () => {
    const source = readFileSync(new URL("../FlowingSemanticEdge.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("markerEnd");
    expect(source).toContain("uc-edge-flow-forward");
    expect(source).toContain("uc-edge-flow-reverse");
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain('animationDelay: "-.425s"');
    expect(source).not.toMatch(/aria-hidden="true"\s+className="uc-semantic-edge-label"/);
    expect(source).toMatch(/aria-hidden="true"\s+className="uc-semantic-edge-direction"/);
  });

  it("keeps selection and reduced motion outside the structural layout key", () => {
    const source = readFileSync(new URL("../SemanticGraphCanvas.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const structureKey");
    const end = source.indexOf("const { nodes, edges }");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const layoutSource = source.slice(start, end);
    expect(layoutSource).toContain("node.id");
    expect(layoutSource).toContain("node.kind");
    expect(layoutSource).toContain("edge.source");
    expect(layoutSource).toContain("edge.target");
    expect(layoutSource).not.toContain("selectedNodeId");
    expect(layoutSource).not.toContain("reducedMotion");
  });
});
