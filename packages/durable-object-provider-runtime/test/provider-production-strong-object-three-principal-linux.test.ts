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
const e2eTimeout = process.env.RUN_STEP16_DUAL_HOST_E2E === "1"
  ? 30 * 60 * 1000
  : 15 * 60 * 1000;

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
      timeout: e2eTimeout,
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
    if (process.env.RUN_STEP16_DUAL_HOST_E2E === "1") {
      expect(result.dualHost).toMatchObject({
        profile: "step16_dual_host_strong_alpha_linux_v1",
        status: "blocked",
        hosts: ["codex", "claude"],
        hostExecution: {
          status: "blocked",
        },
        toolCount: 11,
        goldGate: {
          profile: "alpha_gold_gate_evidence_v1",
          syntheticVertical: {
            countsTowardG2OrG3: false,
            executionSurface: "installed_wrapper_stdio",
            hostAuthority: "trusted_installation_wrappers_only",
          },
          sources: {
            alphaA: {
              revision: "34da354968a6071d914e4e4a4fca738e6c2d8a29",
            },
            alphaB: {
              revision: "01aa1dac22db7d30e92818486190cef6b342fc18",
              ownerAuthorizationObserved: false,
              localCorpusAvailable: false,
              copiedIntoRepository: false,
            },
          },
          hostRuns: {
            codex: { status: "blocked", requiredTasks: 24, passedTasks: 0 },
            claude: { status: "blocked", requiredTasks: 24, passedTasks: 0 },
          },
          g2: {
            status: "blocked",
            requiredPassedTasks: 12,
          },
          g3: {
            status: "blocked",
            requiredGoldTasksPerHost: 24,
            requiredHostTaskExecutions: 48,
            artifactTaskRevisionIdentityMatched: false,
          },
        },
      });
      expect(result.closingEvidenceSafety).toEqual({
        symlinkPreset: "rejected_zero_write",
        unknownPath: "rejected_zero_write",
        create: "exclusive_nofollow_root_owned_fsync",
      });
      if (result.dualHost.syntheticVertical?.status === "verified") {
        expect(result.dualHost).toMatchObject({
          status: "blocked",
          hostExecution: {
            status: "blocked",
            blocker: "real_host_tool_call_not_exercised",
          },
          syntheticVertical: {
            status: "verified",
            executionSurface: "installed_wrapper_stdio",
            hostAuthority: "trusted_installation_wrappers_only",
            independentInstallations: true,
            providerBinding: "self_relative_owned_activation",
            ambientSelection: "poisoned_environment_ignored",
          },
          rootFailClosed: "verified_both_hosts_zero_write",
          externalSourceMutation: "verified",
          taskStatus: "verified",
          sharedArtifacts: "byte_equivalent_public_results",
          lifecycle:
            "marketplace_install_upgrade_reinstall_remove_doctor_clean_close",
        });
        expect(result.durableCurrent.revision).toBe(
          result.dualHost.providerRevision,
        );
        expect(result.dualHost.actualSnapshotId).not.toBe(
          result.dualHost.baselineSnapshotId,
        );
      } else {
        expect(result.dualHost).toMatchObject({
          status: "blocked",
          hostExecution: {
            status: "blocked",
            blocker: "real_host_clis_unavailable",
          },
          syntheticVertical: {
            status: "failed",
            executionSurface: "installed_wrapper_stdio",
            hostAuthority: "trusted_installation_wrappers_only",
          },
          rootFailClosed: "not_run",
          lifecycle: "not_run",
        });
      }
    }
  }, e2eTimeout);
});
