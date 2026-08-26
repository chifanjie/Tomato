import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const runnable = process.platform === "linux" && process.geteuid?.() === 0;

describe.skipIf(!runnable)("production strong client trust lifecycle on Linux", () => {
  it("installs, rotates, rolls back, and uninstalls the exact signed snapshot", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      new URL(
        "./provider-production-strong-client-trust-lifecycle-linux.mjs",
        import.meta.url,
      ).pathname,
    ]);
    expect(JSON.parse(stdout)).toEqual({
      profile: "provider_production_strong_client_trust_lifecycle_linux_v1",
      status: "verified",
      install: "verified",
      rotate: "verified",
      rollback: "verified",
      uninstall: "verified",
    });
  }, 30_000);
});
