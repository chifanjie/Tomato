import { describe, expect, it } from "vitest";
import {
  parseStoredThemeConfig,
  serializeThemeConfig,
  THEME_STORAGE_VERSION,
} from "../ThemeContext";

describe("theme storage migration", () => {
  it("ignores legacy stored themes without a storage version", () => {
    expect(parseStoredThemeConfig('{"presetId":"dark-gold","accentId":"gold"}')).toBeNull();
  });

  it("loads current-version stored themes", () => {
    const raw = JSON.stringify({
      version: THEME_STORAGE_VERSION,
      presetId: "technical-document",
      accentId: "teal",
      headingFont: "sans",
    });

    expect(parseStoredThemeConfig(raw)).toEqual({
      presetId: "technical-document",
      accentId: "teal",
      headingFont: "sans",
    });
  });

  it("serializes themes with the current storage version", () => {
    expect(
      JSON.parse(
        serializeThemeConfig({
          presetId: "engineering-workbench",
          accentId: "teal",
          headingFont: "sans",
        }),
      ),
    ).toMatchObject({
      version: THEME_STORAGE_VERSION,
      presetId: "engineering-workbench",
      accentId: "teal",
      headingFont: "sans",
    });
  });
});
