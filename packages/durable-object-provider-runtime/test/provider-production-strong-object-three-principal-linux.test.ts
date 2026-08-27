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
      nativeExactObject: {
        status: "verified",
        exactObject: "verified",
        noReplace: "verified",
        renameReparent: "rejected_zero_write",
        pathnameAba: "rejected_zero_write",
        sourceSwap: "rejected_zero_write",
      },
      caller: {
        role: "caller",
        keyDenied: true,
        keyDenials: 4,
        write: "committed",
        check: "committed",
        checkReplay: "committed",
        verification: "committed",
        revision: 3,
        revisionOnly: true,
        reservedForgeryRejected: true,
      },
      restartReplay: {
        role: "caller",
        keyDenied: true,
        keyDenials: 4,
        write: "committed",
        check: "committed",
        checkReplay: "committed",
        verification: "committed",
        revision: 3,
      },
      restartSockets: {
        retainedAfterSigkill: "verified",
        broker: "reclaimed",
        runtime: "reclaimed",
        gateway: "reclaimed",
        startOrder: "authority_runtime_gateway",
      },
      lifecycleLease: {
        liveUninstall: "refused_zero_write",
        doubleStart: "rejected",
      },
      casNonce: {
        role: "cas-probe",
        writeNonceConflict: true,
        compareNonceConflict: true,
        stale: "stale",
        staleReplay: "stale",
        revision: 4,
      },
      trustRotationReplay: {
        role: "trust-rotation-replay",
        acceptanceOrdinal: 2,
        resolution: "committed",
        originalRevision: 2,
        currentRevision: 4,
        zeroWrite: true,
      },
      durableCurrent: {
        revision: 4,
        lifecycleArtifactCount: 17,
        businessHeadPresent: true,
      },
      lifecycle: {
        install: "installed",
        upgrade: "rotated",
        rollback: "rolled_back",
        uninstall: "uninstalled",
        retainedIdentity: "verified",
      },
    });
    expect(result.runtimeUid).toBe(result.nativeExactObject.principalUid);
    expect(result.callerUid).toBe(result.caller.callerUid);
    expect(new Set([
      result.authorityUid,
      result.runtimeUid,
      result.callerUid,
    ]).size).toBe(3);
    expect(result.restartReplay.read).toBe(result.caller.read);
  }, 15 * 60 * 1000);
});
