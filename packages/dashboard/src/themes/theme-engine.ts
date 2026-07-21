import type { ThemeConfig } from "./types.ts";
import { getPreset } from "./presets.ts";

export function applyTheme(
  config: ThemeConfig,
  root: HTMLElement = document.documentElement,
): void {
  const preset = getPreset(config.presetId);
  root.dataset.themePreset = preset.id;
  root.dataset.themeScheme = preset.scheme;
  root.dataset.theme = preset.scheme;
  root.style.colorScheme = preset.scheme;
}
