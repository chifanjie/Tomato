import { describe, expect, it } from "vitest";
import { buildSourceSnapshot, excerptForLineRange } from "../source-snapshot.js";

describe("snapshot excerpt line reuse", () => {
  it("preserves CRLF normalization, line bounds and changes to a supplied snapshot", () => {
    const snapshot = buildSourceSnapshot("src/example.ts", { "src/example.ts": "first\r\nsecond\r\nthird\n" });
    expect(excerptForLineRange(snapshot, [1, 2])).toBe("first\nsecond");
    expect(excerptForLineRange(snapshot, [2, 4])).toBe("second\nthird\n");
    expect(excerptForLineRange(snapshot, [0, 50])).toBe("first\nsecond\nthird\n");
    expect(excerptForLineRange(snapshot, [50, 60])).toBe("");
    snapshot.text = "replaced\nsource";
    expect(excerptForLineRange(snapshot, [1, 2])).toBe("replaced\nsource");
  });
});
