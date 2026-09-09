import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SKILLS_DIR = "skills";

const skillFiles = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(SKILLS_DIR, entry.name, "SKILL.md"))
  .filter((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });

/** Extracts fenced ```bash blocks, ignoring indentation of the fence. */
function bashBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  let current;
  let fenceIndent = 0;
  for (const line of lines) {
    const open = line.match(/^(\s*)```bash\s*$/);
    if (open && current === undefined) {
      fenceIndent = open[1].length;
      current = [];
      continue;
    }
    if (current !== undefined && /^\s*```\s*$/.test(line)) {
      blocks.push(current.join("\n"));
      current = undefined;
      continue;
    }
    if (current !== undefined) current.push(line.slice(fenceIndent));
  }
  return blocks;
}

describe("SKILL.md shell blocks", () => {
  it("finds skills to check", () => {
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  for (const path of skillFiles) {
    const markdown = readFileSync(path, "utf8");
    const blocks = bashBlocks(markdown);

    blocks.forEach((block, index) => {
      it(`${path} bash block #${index + 1} parses`, () => {
        // `bash -n` parses without executing, catching unbalanced if/for/quotes.
        expect(() =>
          execFileSync("bash", ["-n"], { input: block, stdio: ["pipe", "pipe", "pipe"] }),
        ).not.toThrow();
      });
    });

    it(`${path} resolves PLUGIN_ROOT before using it`, () => {
      // understand-full previously ran `node "$PLUGIN_ROOT/..."` with the
      // variable never assigned, expanding to an absolute path at the fs root.
      const usesPluginRoot = /\$\{?PLUGIN_ROOT\b/.test(markdown);
      if (!usesPluginRoot) return;
      expect(markdown).toMatch(/resolve-plugin-root\.sh/);
    });
  }
});
