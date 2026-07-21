import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "../types";
import {
  PRESETS,
  getPreset,
  isPresetId,
  normalizePresetId,
} from "../presets";

describe("dashboard theme presets", () => {
  it("publishes the curated packs in a stable order", () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual([
      "technical-document",
      "mist-blueprint",
      "sage-paper",
      "night-ink",
    ]);
    expect(PRESETS.map((preset) => preset.name)).toEqual([
      "技术文档 2.0",
      "雾蓝蓝图",
      "鼠尾草纸",
      "夜墨",
    ]);
    expect(PRESETS.every((preset) => /\p{Script=Han}/u.test(preset.description))).toBe(true);
  });

  it("uses technical document as the default", () => {
    expect(DEFAULT_THEME_CONFIG).toEqual({ presetId: "technical-document" });
  });

  it("normalizes retired and unknown ids", () => {
    expect(normalizePresetId("engineering-workbench")).toBe("night-ink");
    expect(normalizePresetId("technical-document")).toBe("technical-document");
    expect(normalizePresetId("unknown")).toBe("technical-document");
    expect(isPresetId("sage-paper")).toBe(true);
    expect(isPresetId("engineering-workbench")).toBe(false);
    expect(getPreset("missing").id).toBe("technical-document");
  });
});
