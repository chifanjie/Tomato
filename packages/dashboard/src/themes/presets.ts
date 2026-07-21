import type { PresetId, ThemePreset } from "./types.ts";

export const PRESETS = [
  {
    id: "technical-document",
    name: "技术文档 2.0",
    description: "暖白纸面、石墨正文与克制青绿色。",
    scheme: "light",
  },
  {
    id: "mist-blueprint",
    name: "雾蓝蓝图",
    description: "冷白画布、海军蓝正文与柔和蓝色。",
    scheme: "light",
  },
  {
    id: "sage-paper",
    name: "鼠尾草纸",
    description: "灰绿纸面、深云杉正文与安静层次。",
    scheme: "light",
  },
  {
    id: "night-ink",
    name: "夜墨",
    description: "深海军蓝、蓝灰表面与柔和靛蓝。",
    scheme: "dark",
  },
] as const satisfies readonly ThemePreset[];

const PRESET_IDS = new Set<string>(PRESETS.map((preset) => preset.id));

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === "string" && PRESET_IDS.has(value);
}

export function normalizePresetId(value: unknown): PresetId {
  if (value === "engineering-workbench") return "night-ink";
  return isPresetId(value) ? value : "technical-document";
}

export function getPreset(value: unknown): ThemePreset {
  const id = normalizePresetId(value);
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
