export type PresetId =
  | "technical-document"
  | "mist-blueprint"
  | "sage-paper"
  | "night-ink";

export type ThemeScheme = "light" | "dark";

export interface ThemePreset {
  id: PresetId;
  name: string;
  description: string;
  scheme: ThemeScheme;
}

export interface ThemeConfig {
  presetId: PresetId;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  presetId: "technical-document",
};
