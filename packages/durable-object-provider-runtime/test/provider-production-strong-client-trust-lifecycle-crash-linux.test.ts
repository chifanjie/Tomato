import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("production strong client trust lifecycle crash recovery on Linux", () => {
  it.skipIf(process.platform !== "linux" || process.geteuid?.() !== 0)(
    "reinvokes every SIGKILL phase without residue",
    async () => {
      const script = new URL(
        "./provider-production-strong-client-trust-lifecycle-crash-linux.mjs",
        import.meta.url,
      );
      const { stdout } = await execFileAsync(process.execPath, [script.pathname], {
        env: { ...process.env, NODE_ENV: "production" },
        maxBuffer: 1024 * 1024,
        timeout: 180_000,
      });
      const result = JSON.parse(stdout.trim()) as Record<string, unknown>;
      expect(result).toMatchObject({
        profile: "provider_production_strong_client_trust_lifecycle_crash_linux_v1",
        status: "verified",
        verifiedCuts: 22,
        recovery: "reinvoke_converged",
        rejectedForeignDirectories: 2,
        rotateRaceVerified: true,
        uninstallRaceVerified: true,
      });
    },
    240_000,
  );
});
