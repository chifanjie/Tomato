import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTPUT_LANGUAGE,
  buildOutputLanguageDirective,
  isSimplifiedChineseOutputLanguage,
} from "../analyzer/output-language.js";

describe("output-language defaults", () => {
  it("uses Simplified Chinese as the default generated-content language", () => {
    expect(DEFAULT_OUTPUT_LANGUAGE).toBe("zh");
    expect(isSimplifiedChineseOutputLanguage()).toBe(true);
    expect(buildOutputLanguageDirective()).toContain("Simplified Chinese");
  });
});
