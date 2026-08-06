import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
);
const workflow = readFileSync(workflowPath, "utf8");

describe("CI workflow contract", () => {
  it("runs the complete workspace and active-surface quality gates", () => {
    expect(workflow).toContain("run: pnpm install --frozen-lockfile");
    expect(workflow).toContain("run: pnpm quality");
    expect(workflow).toContain(
      "run: pnpm --filter @understand-code/dashboard audit:surface",
    );
    expect(workflow.indexOf("run: pnpm quality")).toBeLessThan(
      workflow.indexOf(
        "run: pnpm --filter @understand-code/dashboard audit:surface",
      ),
    );
  });

  it("uses the Node 24-compatible action generation with a pinned project toolchain", () => {
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("uses: pnpm/action-setup@v6");
    expect(workflow).toContain("node-version: 22.x");
    expect(workflow).toMatch(/version:\s*9\b/);
    expect(workflow).toContain("cache-dependency-path: pnpm-lock.yaml");
    expect(workflow).not.toMatch(/uses:\s*\S+@v[1-5]\b/);
  });

  it("keeps the workflow read-only, bounded, and cancellation-aware", () => {
    expect(workflow).toMatch(/permissions:\n\s+contents:\s+read/);
    expect(workflow).not.toMatch(/contents:\s+write|write-all/);
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 45");
    expect(workflow).toMatch(/on:\n\s+push:\n\s+pull_request:/);
  });
});
