import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "../types";
import { getAccent, getPreset, PRESETS } from "../presets";

const REQUIRED_COLOR_KEYS = [
  "root",
  "surface",
  "elevated",
  "panel",
  "text-primary",
  "text-secondary",
  "text-muted",
  "node-file",
  "node-function",
  "node-class",
  "node-module",
  "node-concept",
] as const;

describe("dashboard theme presets", () => {
  it("includes engineering workbench and technical document presets", () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual([
      "engineering-workbench",
      "technical-document",
    ]);
  });

  it("uses engineering workbench as the default theme", () => {
    expect(DEFAULT_THEME_CONFIG).toMatchObject({
      presetId: "engineering-workbench",
      accentId: "teal",
    });
  });

  it("defines all required color tokens for the new presets", () => {
    for (const id of ["engineering-workbench", "technical-document"] as const) {
      const preset = getPreset(id);
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(preset.colors[key], `${id} missing ${key}`).toBeTruthy();
      }
      expect(getAccent(preset, preset.defaultAccentId).id).toBe(preset.defaultAccentId);
    }
  });
});
