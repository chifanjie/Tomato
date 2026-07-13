import type { AccentSwatch, ThemePreset } from "./types.ts";

const DARK_ACCENT_SWATCHES: AccentSwatch[] = [
  { id: "gold", name: "金色", accent: "#d4a574", accentDim: "#c9a96e", accentBright: "#e8c49a" },
  { id: "ocean", name: "海蓝", accent: "#5ba4cf", accentDim: "#4e93ba", accentBright: "#7abce0" },
  { id: "emerald", name: "翡翠绿", accent: "#5ea67a", accentDim: "#4e9468", accentBright: "#78c492" },
  { id: "rose", name: "玫瑰", accent: "#cf7a8a", accentDim: "#b96e7e", accentBright: "#e094a4" },
  { id: "purple", name: "紫色", accent: "#9b7abf", accentDim: "#876bb0", accentBright: "#b494d4" },
  { id: "amber", name: "琥珀", accent: "#c9963a", accentDim: "#b5862e", accentBright: "#ddb05c" },
  { id: "teal", name: "青绿", accent: "#4aab9a", accentDim: "#3d9686", accentBright: "#68c4b4" },
  { id: "silver", name: "银色", accent: "#a0a8b0", accentDim: "#8e959c", accentBright: "#b8bfc6" },
];

const LIGHT_ACCENT_SWATCHES: AccentSwatch[] = [
  { id: "indigo", name: "靛蓝", accent: "#4a6fa5", accentDim: "#3d5f8f", accentBright: "#6088bf" },
  { id: "ocean", name: "海蓝", accent: "#3a8ab5", accentDim: "#2e7aa0", accentBright: "#55a0cc" },
  { id: "emerald", name: "翡翠绿", accent: "#3a8a5c", accentDim: "#2e7a4e", accentBright: "#55a878" },
  { id: "rose", name: "玫瑰", accent: "#a5566a", accentDim: "#8f4a5c", accentBright: "#bf6e82" },
  { id: "purple", name: "紫色", accent: "#6b5a9e", accentDim: "#5c4d8a", accentBright: "#8474b5" },
  { id: "amber", name: "琥珀", accent: "#9e7a30", accentDim: "#8a6a28", accentBright: "#b5923e" },
  { id: "teal", name: "青绿", accent: "#2e8a7a", accentDim: "#267a6c", accentBright: "#45a595" },
  { id: "slate", name: "石板灰", accent: "#5a6570", accentDim: "#4e5860", accentBright: "#6e7a85" },
];

export const PRESETS: ThemePreset[] = [
  {
    id: "engineering-workbench",
    name: "工程工作台",
    isDark: true,
    defaultAccentId: "teal",
    accentSwatches: DARK_ACCENT_SWATCHES,
    colors: {
      root: "#0d1114",
      surface: "#12181d",
      elevated: "#182127",
      panel: "#141b20",
      "text-primary": "#edf2f2",
      "text-secondary": "#a4b0b0",
      "text-muted": "#657476",
      "node-file": "#5f9fb8",
      "node-function": "#67b98f",
      "node-class": "#b294d8",
      "node-module": "#d2a85f",
      "node-concept": "#d0899e",
      "node-config": "#5ed6c8",
      "node-document": "#78bee6",
      "node-service": "#9da7f2",
      "node-table": "#73d7aa",
      "node-endpoint": "#e5a665",
      "node-pipeline": "#dc8390",
      "node-schema": "#dcc85d",
      "node-resource": "#97a9e8",
    },
  },
  {
    id: "technical-document",
    name: "技术文档",
    isDark: false,
    defaultAccentId: "teal",
    accentSwatches: LIGHT_ACCENT_SWATCHES,
    colors: {
      root: "#f7f6f2",
      surface: "#fffefa",
      elevated: "#ffffff",
      panel: "#eeebe3",
      "text-primary": "#20272a",
      "text-secondary": "#5c6668",
      "text-muted": "#899294",
      "node-file": "#3f7f99",
      "node-function": "#357f5f",
      "node-class": "#71589a",
      "node-module": "#9a7537",
      "node-concept": "#9a5d72",
      "node-config": "#218c82",
      "node-document": "#287ca8",
      "node-service": "#656fd0",
      "node-table": "#2f9a72",
      "node-endpoint": "#b56e29",
      "node-pipeline": "#b95767",
      "node-schema": "#9a8524",
      "node-resource": "#6574c8",
    },
  },
];

export function getPreset(id: string): ThemePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function getAccent(preset: ThemePreset, accentId: string): AccentSwatch {
  return (
    preset.accentSwatches.find((s) => s.id === accentId) ??
    preset.accentSwatches.find((s) => s.id === preset.defaultAccentId) ??
    preset.accentSwatches[0]
  );
}
