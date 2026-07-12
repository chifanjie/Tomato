import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("ThemePicker Simplified Chinese contract", () => {
  it("uses exact local copy without the removed i18n context", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../ThemePicker.tsx"),
      "utf8",
    );
    expect(source).not.toContain("useI18n");
    for (const label of [
      "切换主题",
      "主题",
      "强调色",
      "标题字体",
      "衬线",
      "无衬线",
      "等宽",
    ]) {
      expect(source).toContain(label);
    }
  });
});
