import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(__dirname, "../../../../skills");

const skillFiles = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    directoryName: entry.name,
    path: join(skillsRoot, entry.name, "SKILL.md"),
  }));

describe("skill frontmatter", () => {
  it.each(skillFiles)(
    "$directoryName has valid runtime metadata",
    ({ directoryName, path }) => {
      const source = readFileSync(path, "utf8");
      const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      expect(match, `${path} must begin with YAML frontmatter`).not.toBeNull();

      const document = parseDocument(match?.[1] ?? "");
      expect(
        document.errors.map((error) => error.message),
        `${path} contains invalid YAML frontmatter`,
      ).toEqual([]);

      const metadata = document.toJS();
      expect(metadata).toMatchObject({
        name: directoryName,
      });
      expect(typeof metadata.description).toBe("string");
      expect(metadata.description.trim().length).toBeGreaterThan(0);
      if (Object.hasOwn(metadata, "argument-hint")) {
        const argumentHint = metadata["argument-hint"];
        expect(
          typeof argumentHint === "string" ||
            (Array.isArray(argumentHint) &&
              argumentHint.every((item) => typeof item === "string")),
        ).toBe(true);
      }
    },
  );
});
