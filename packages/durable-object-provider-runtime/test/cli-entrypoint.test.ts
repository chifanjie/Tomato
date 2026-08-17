import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("provider runtime CLI entrypoint", () => {
  it("runs through an installed bin symlink instead of silently exiting", async () => {
    const root = await mkdtemp(join(tmpdir(), "uc-provider-runtime-bin-"));
    const executable = join(root, "provider-runtime");
    await symlink(join(packageRoot, "dist/cli.js"), executable);
    try {
      const result = spawnSync(process.execPath, [executable, "--help"], {
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Usage: understand-code-durable-provider-runtime");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
