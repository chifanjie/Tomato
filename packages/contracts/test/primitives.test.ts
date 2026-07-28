import { describe, expect, it } from "vitest";
import {
  ContentDigestSchema,
  IsoTimestampSchema,
  LineRangeSchema,
  ProducerVersionSchema,
  RepositoryRelativePathSchema,
  TaskIdSchema,
} from "../src/primitives.js";

describe("contract primitives", () => {
  it("accepts canonical IDs, timestamps, versions, digests, paths, and line ranges", () => {
    expect(TaskIdSchema.parse("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    );
    expect(IsoTimestampSchema.parse("2026-07-28T08:30:00.123Z")).toBe(
      "2026-07-28T08:30:00.123Z",
    );
    expect(ProducerVersionSchema.parse("3.0.0-alpha.1")).toBe("3.0.0-alpha.1");
    expect(ContentDigestSchema.parse(`sha256:${"a".repeat(64)}`)).toBe(
      `sha256:${"a".repeat(64)}`,
    );
    expect(
      RepositoryRelativePathSchema.parse(
        ".understand-code/knowledge-base/wiki-index.json",
      ),
    ).toBe(".understand-code/knowledge-base/wiki-index.json");
    expect(LineRangeSchema.parse([1, 25])).toEqual([1, 25]);
  });

  it.each([
    "/etc/passwd",
    "../secret",
    "src/../secret",
    "src\\index.ts",
    "C:/repo/file.ts",
    "src//index.ts",
    "./src/index.ts",
  ])("rejects unsafe repository-relative path %s", (path) => {
    expect(RepositoryRelativePathSchema.safeParse(path).success).toBe(false);
  });

  it("rejects noncanonical scalar representations", () => {
    expect(TaskIdSchema.safeParse("01arz3ndektsv4rrffq69g5fav").success).toBe(false);
    expect(IsoTimestampSchema.safeParse("2026-02-31T08:30:00Z").success).toBe(false);
    expect(ProducerVersionSchema.safeParse("v3").success).toBe(false);
    expect(ContentDigestSchema.safeParse("A".repeat(64)).success).toBe(false);
    expect(ContentDigestSchema.safeParse(`sha256:${"A".repeat(64)}`).success).toBe(false);
    expect(LineRangeSchema.safeParse([10, 9]).success).toBe(false);
    expect(LineRangeSchema.safeParse([0, 1]).success).toBe(false);
  });
});
