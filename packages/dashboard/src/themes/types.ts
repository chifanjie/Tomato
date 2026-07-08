export type PresetId =
  | "engineering-workbench"
  | "technical-document";

export interface AccentSwatch {
  id: string;
  name: string;
  accent: string;
  accentDim: string;
  accentBright: string;
}

export interface ThemePreset {
  id: PresetId;
  name: string;
  isDark: boolean;
  colors: Record<string, string>;
  accentSwatches: AccentSwatch[];
  defaultAccentId: string;
}

export type HeadingFont = "serif" | "sans" | "mono";

export interface ThemeConfig {
  presetId: PresetId;
  accentId: string;
  headingFont?: HeadingFont;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  presetId: "engineering-workbench",
  accentId: "teal",
  headingFont: "sans",
};
