import { describe, expect, it } from "vitest";
import {
  normalizeThemePreference,
  parseStoredThemeConfig,
  serializeThemeConfig,
  THEME_STORAGE_VERSION,
} from "../themeStorage";

describe("theme storage v3", () => {
  it.each([
    [{ version: 2, presetId: "engineering-workbench", accentId: "rose" }, "night-ink"],
    [{ version: 2, presetId: "technical-document", headingFont: "mono" }, "technical-document"],
    [{ version: 3, presetId: "sage-paper" }, "sage-paper"],
    [{ presetId: "engineering-workbench", accentId: "teal" }, "night-ink"],
    [{ presetId: "unknown" }, "technical-document"],
    [{ version: 99, presetId: "night-ink" }, "technical-document"],
  ] as const)("normalizes %j", (input, presetId) => {
    expect(normalizeThemePreference(input)).toEqual({ presetId });
  });

  it("distinguishes a missing key from invalid saved content", () => {
    expect(parseStoredThemeConfig(null)).toBeNull();
    expect(parseStoredThemeConfig("{")).toEqual({ presetId: "technical-document" });
    expect(parseStoredThemeConfig(JSON.stringify({ presetId: "night-ink" })))
      .toEqual({ presetId: "technical-document" });
  });

  it("serializes only the v3 preset", () => {
    expect(THEME_STORAGE_VERSION).toBe(3);
    expect(JSON.parse(serializeThemeConfig({ presetId: "mist-blueprint" }))).toEqual({
      version: 3,
      presetId: "mist-blueprint",
    });
  });
});
