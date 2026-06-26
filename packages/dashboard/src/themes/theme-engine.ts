import type { ThemeConfig } from "./types.ts";
import { getAccent, getPreset } from "./presets.ts";

export function hexToRgb(hex: string): string {
  return hexToRgbParts(hex).join(", ");
}

function hexToRgbParts(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbParts(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveFromAccent(
  accentHex: string,
  isDark: boolean,
  surfaceHex: string,
  elevatedHex: string,
): Record<string, string> {
  const rgb = hexToRgb(accentHex);
  return {
    "color-border-subtle": `rgba(${rgb}, ${isDark ? 0.12 : 0.14})`,
    "color-border-medium": `rgba(${rgb}, ${isDark ? 0.25 : 0.22})`,
    "glass-bg": rgbaFromHex(surfaceHex, isDark ? 0.82 : 0.86),
    "glass-bg-heavy": rgbaFromHex(surfaceHex, isDark ? 0.96 : 0.97),
    "glass-border": `rgba(${rgb}, ${isDark ? 0.1 : 0.1})`,
    "glass-border-heavy": `rgba(${rgb}, ${isDark ? 0.15 : 0.16})`,
    "scrollbar-thumb": `rgba(${rgb}, ${isDark ? 0.22 : 0.24})`,
    "scrollbar-thumb-hover": `rgba(${rgb}, ${isDark ? 0.36 : 0.38})`,
    "glow-accent": `rgba(${rgb}, ${isDark ? 0.15 : 0.12})`,
    "glow-accent-strong": `rgba(${rgb}, ${isDark ? 0.4 : 0.28})`,
    "glow-accent-pulse": `rgba(${rgb}, ${isDark ? 0.6 : 0.42})`,
    "color-edge": `rgba(${rgb}, ${isDark ? 0.3 : 0.22})`,
    "color-edge-dim": `rgba(${rgb}, ${isDark ? 0.08 : 0.06})`,
    "color-edge-dot": `rgba(${rgb}, ${isDark ? 0.15 : 0.12})`,
    "color-accent-overlay-bg": `rgba(${rgb}, ${isDark ? 0.05 : 0.08})`,
    "color-accent-overlay-border": `rgba(${rgb}, ${isDark ? 0.25 : 0.2})`,
    "kbd-bg": rgbaFromHex(elevatedHex, isDark ? 0.8 : 0.95),
  };
}

export function applyTheme(config: ThemeConfig): void {
  const preset = getPreset(config.presetId);
  const accent = getAccent(preset, config.accentId);
  const style = document.documentElement.style;

  // 1. Apply base preset colors
  for (const [key, value] of Object.entries(preset.colors)) {
    style.setProperty(`--color-${key}`, value);
  }

  // 2. Apply accent colors from swatch
  style.setProperty("--color-accent", accent.accent);
  style.setProperty("--color-accent-dim", accent.accentDim);
  style.setProperty("--color-accent-bright", accent.accentBright);

  // 3. Apply derived values
  const derived = deriveFromAccent(
    accent.accent,
    preset.isDark,
    preset.colors.surface,
    preset.colors.elevated,
  );
  for (const [key, value] of Object.entries(derived)) {
    style.setProperty(`--${key}`, value);
  }

  // 4. Set data-theme for CSS-only selectors
  document.documentElement.setAttribute("data-theme", preset.isDark ? "dark" : "light");

  // 5. Apply heading font preference
  const fontMap: Record<string, string> = {
    serif: "var(--font-serif)",
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
  };
  const headingFont = config.headingFont ?? "serif";
  style.setProperty("--font-heading", fontMap[headingFont] ?? fontMap.serif);
}
