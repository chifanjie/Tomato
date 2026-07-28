import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolutePath] : [];
  });
}

describe("contracts runtime boundary", () => {
  it("has no filesystem, Git, crypto, React, or host runtime imports", () => {
    const forbiddenImport =
      /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:node:|fs(?:\/|["'])|path(?:\/|["'])|crypto(?:\/|["'])|child_process(?:\/|["'])|simple-git(?:\/|["'])|react(?:-dom|\/|["']))/u;
    const forbiddenHostGlobal =
      /(?:^|[^\w$])(?:process|Buffer)(?:\s*[.([]|\s*$)/mu;

    for (const forbiddenExample of [
      'import "node:fs";',
      'const fs = require("fs");',
      'const digest = Buffer.from("payload");',
      "process.cwd();",
    ]) {
      expect(
        forbiddenImport.test(forbiddenExample) ||
          forbiddenHostGlobal.test(forbiddenExample),
        `boundary detector missed ${forbiddenExample}`,
      ).toBe(true);
    }

    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(
        source,
        `${filePath} crosses the portable Contracts runtime boundary`,
      ).not.toMatch(forbiddenImport);
      expect(
        source,
        `${filePath} uses a Node host global`,
      ).not.toMatch(forbiddenHostGlobal);
    }
  });

  it("uses strict Zod objects instead of silent unknown-field stripping", () => {
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, `${filePath} uses z.object`).not.toMatch(/\bz\.object\s*\(/u);
      expect(source, `${filePath} uses passthrough`).not.toMatch(/\.passthrough\s*\(/u);
    }
  });
});
