import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { directionIndicator } from "../FlowingSemanticEdge";

describe("FlowingSemanticEdge", () => {
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
