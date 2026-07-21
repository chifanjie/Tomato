import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = resolve(__dirname, "../../../../skills/understand-full/SKILL.md");

describe("understand-full skill", () => {
  it("documents a single full-flow entrypoint from graph to dashboard-linked knowledge base", () => {
    expect(existsSync(SKILL_PATH)).toBe(true);

    const skill = readFileSync(SKILL_PATH, "utf-8");
    expect(skill).toContain("name: understand-full");
    expect(skill).toContain("# /understand-full");

    const phases = [
      "Phase 1 - Generate graph",
      "Phase 2 - Launch dashboard for the graph",
      "Phase 3 - Generate knowledge base",
      "Phase 4 - Verify dashboard linkage",
    ];
    const phasePositions = phases.map((phase) => skill.indexOf(phase));
    expect(phasePositions.every((position) => position >= 0)).toBe(true);
    expect(phasePositions).toEqual([...phasePositions].sort((a, b) => a - b));

    expect(skill).toContain("/understand");
    expect(skill).toContain("/understand-dashboard");
    expect(skill).toContain("/understand-kb");
    expect(skill).toContain(".understand-code/knowledge-base/");
    expect(skill).toContain("?token=");
  });
});
