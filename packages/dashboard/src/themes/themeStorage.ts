import { normalizePresetId } from "./presets";
import { DEFAULT_THEME_CONFIG, type ThemeConfig } from "./types";

export const THEME_STORAGE_KEY = "uc-theme";
export const THEME_STORAGE_VERSION = 3 as const;

export function normalizeThemePreference(value: unknown): ThemeConfig {
  if (!value || typeof value !== "object") return DEFAULT_THEME_CONFIG;
  const input = value as { version?: unknown; presetId?: unknown };
  if (
    input.version !== undefined
    && input.version !== 2
    && input.version !== THEME_STORAGE_VERSION
  ) {
    return DEFAULT_THEME_CONFIG;
  }
  return { presetId: normalizePresetId(input.presetId) };
}

export function parseStoredThemeConfig(raw: string | null): ThemeConfig | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { version?: unknown } | null;
    if (
      !value
      || typeof value !== "object"
      || (value.version !== 2 && value.version !== THEME_STORAGE_VERSION)
    ) return DEFAULT_THEME_CONFIG;
    return normalizeThemePreference(value);
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export function serializeThemeConfig(config: ThemeConfig): string {
  return JSON.stringify({
    version: THEME_STORAGE_VERSION,
    presetId: config.presetId,
  });
}
