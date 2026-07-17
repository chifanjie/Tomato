import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PRESET_CSS = readFileSync(
  join(process.cwd(), "src/themes/theme-presets.css"),
  "utf8",
);
const INDEX_CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

const GRAPH_TOKENS = [
  "canvas", "grid", "minimap-bg", "minimap-mask",
  "control-bg", "control-border", "control-fg",
  "node-bg", "node-border", "node-selected-bg",
  "node-selected-border", "node-neighbor-border",
  "edge", "edge-active", "edge-muted", "edge-label-bg",
  "edge-label-text", "marker-scope", "marker-cluster",
  "marker-file", "marker-symbol", "marker-raw", "marker-boundary",
  "status-direct", "status-context", "status-missing", "status-problem",
] as const;

const SHARED_TOKENS = [
  "root", "surface", "elevated", "panel",
  "text-primary", "text-secondary", "text-muted",
  "border-subtle", "border-medium", "accent", "focus", "accent-soft",
] as const;

const DESIGN_PACK_TOKENS = [
  "font-body", "font-heading", "radius-control", "radius-panel", "shadow-overlay",
] as const;

function presetBlock(id: string): string {
  const selector = '[data-theme-preset="' + id + '"]';
  const selectorIndex = PRESET_CSS.indexOf(selector);
  const open = PRESET_CSS.indexOf("{", selectorIndex);
  const close = PRESET_CSS.indexOf("\n}", open);
  if (selectorIndex < 0 || open < 0 || close < 0) throw new Error("missing preset block: " + id);
  return PRESET_CSS.slice(open + 1, close);
}

function tokenHex(block: string, token: string): string {
  const match = block.match(new RegExp("--" + token + ":\\s*(#[0-9a-fA-F]{6})"));
  if (!match?.[1]) throw new Error("missing hex token: " + token);
  return match[1];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const [r, g, b] = values.map((value) => value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("theme preset CSS", () => {
  it("defines a complete design pack and graph palette in every preset block", () => {
    for (const id of [
      "technical-document",
      "mist-blueprint",
      "sage-paper",
      "night-ink",
    ]) {
      const block = presetBlock(id);
      for (const token of GRAPH_TOKENS) expect(block).toContain("--color-graph-" + token + ":");
      for (const token of SHARED_TOKENS) expect(block).toContain("--uc-" + token + ":");
      for (const token of DESIGN_PACK_TOKENS) expect(block).toContain("--uc-" + token + ":");
      expect(contrastRatio(tokenHex(block, "uc-text-primary"), tokenHex(block, "uc-root")))
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokenHex(block, "uc-text-secondary"), tokenHex(block, "uc-root")))
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokenHex(block, "uc-focus"), tokenHex(block, "uc-root")))
        .toBeGreaterThanOrEqual(3);
    }
  });

  it("retires visual noise and hard-coded dark defaults", () => {
    expect(INDEX_CSS).not.toContain("noise-overlay::before");
    expect(INDEX_CSS).not.toContain("radial-gradient");
    expect(INDEX_CSS).not.toContain("rgba(13, 17, 20, 0.72)");
    expect(INDEX_CSS).not.toContain(".node-glow");
    expect(PRESET_CSS).not.toContain("--glow-accent");
    expect(PRESET_CSS).not.toContain("#000000");
    expect(PRESET_CSS).toContain("--color-complexity-complex: var(--color-graph-status-problem)");
  });
});
