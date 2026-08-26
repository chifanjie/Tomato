import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
// The harness requires root, a dedicated ext4 mount, and the real Linux
// principal boundary.  It is opt-in so ordinary macOS/CI runs remain
// read-only; Fedora gate runs set RUN_STEP15_PROVIDER_E2E=1 explicitly.
const runnable =
  process.platform === "linux" &&
  process.geteuid?.() === 0 &&
  process.env.RUN_STEP15_PROVIDER_E2E === "1";

describe.skipIf(!runnable)("production strong object three-principal Linux", () => {
  it("runs the public gateway/client across authority, runtime, and caller principals", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      new URL(
        "./provider-production-strong-object-three-principal-linux.mjs",
        import.meta.url,
      ).pathname,
    ], {
      env: { ...process.env, RUN_STEP15_PROVIDER_E2E: "1" },
      maxBuffer: 4 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
    });
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      profile: "provider_production_strong_object_three_principal_linux_v1",
      status: "verified",
      ext4: true,
      foreignCallerRejected: true,
      authorityUid: 0,
    });
    expect(result.callerUid).toBe(result.caller.callerUid ?? result.callerUid);
    expect(result.restartReplay).toMatchObject({ role: "caller" });
  }, 15 * 60 * 1000);
});
