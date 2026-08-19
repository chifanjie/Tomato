import { spawn } from "node:child_process";
import { basename } from "node:path";

import type {
  ProviderServicePlatformV1,
} from "./service-handoff.js";

const SERVICE_CONTROL_TIMEOUT_MS_V1 = 30_000;

export type ProviderServiceInstallationControlActionInternalV1 =
  | "activate"
  | "restart"
  | "deactivate";

export type ProviderServiceInstallationDurablePhaseInternalV1 =
  | "install_journal_published"
  | "install_runtime_root_marker_published"
  | "upgrade_snapshot_published"
  | "uninstall_first_artifact_removed";

export interface ProviderServiceInstallationControlContextInternalV1 {
  readonly platform: ProviderServicePlatformV1;
  readonly serviceLabel: string;
  readonly descriptorPath: string;
}

export interface ProviderServiceInstallationPrivilegeTestHostInternalV1 {
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly platform: ProviderServicePlatformV1;
  readonly controlService: (
    action: ProviderServiceInstallationControlActionInternalV1,
    context: ProviderServiceInstallationControlContextInternalV1,
  ) => void | Promise<void>;
  /** Test-only crash-cut observer; never supplied by the production mint. */
  readonly afterDurablePhase?: (
    phase: ProviderServiceInstallationDurablePhaseInternalV1,
  ) => void | Promise<void>;
}

declare const providerServiceInstallationPrivilegeBrandInternalV1:
  unique symbol;
export interface ProviderServiceInstallationPrivilegeCapabilityInternalV1 {
  readonly [providerServiceInstallationPrivilegeBrandInternalV1]: true;
}

interface ProviderServiceInstallationPrivilegeStateInternalV1
  extends ProviderServiceInstallationPrivilegeTestHostInternalV1 {
  readonly allowTestDescriptorOverride: boolean;
  readonly recheckAuthority: () => void;
}

const privilegeStatesInternalV1 = new WeakMap<
  object,
  ProviderServiceInstallationPrivilegeStateInternalV1
>();

function validOwnerV1(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validPlatformV1(
  value: unknown,
): value is ProviderServicePlatformV1 {
  return value === "darwin" || value === "linux";
}

function runCommandV1(
  command: string,
  args: readonly string[],
  allowedExitCodes: readonly number[] = [0],
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: "ignore",
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      rejectPromise(new Error("provider service control timed out"));
    }, SERVICE_CONTROL_TIMEOUT_MS_V1);
    const settle = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error === undefined) resolvePromise();
      else rejectPromise(error);
    };
    child.once("error", (error) => settle(error));
    child.once("exit", (code, signal) => {
      if (code !== null && allowedExitCodes.includes(code)) settle();
      else {
        settle(
          new Error(
            `provider service control failed (exit=${String(code)}, signal=${String(signal)})`,
          ),
        );
      }
    });
  });
}

async function controlProductionServiceV1(
  action: ProviderServiceInstallationControlActionInternalV1,
  context: ProviderServiceInstallationControlContextInternalV1,
): Promise<void> {
  if (context.platform === "linux") {
    const systemctlPath = "/usr/bin/systemctl";
    const unit = basename(context.descriptorPath);
    if (action === "activate") {
      await runCommandV1(systemctlPath, ["daemon-reload"]);
      await runCommandV1(systemctlPath, ["enable", "--now", unit]);
      return;
    }
    if (action === "restart") {
      await runCommandV1(systemctlPath, ["daemon-reload"]);
      await runCommandV1(systemctlPath, ["restart", unit]);
      return;
    }
    // stop=5 and disable=1 are systemd's stable "unit not loaded/not found"
    // outcomes; treating those as absent makes journal replay convergent.
    await runCommandV1(systemctlPath, ["stop", unit], [0, 5]);
    await runCommandV1(systemctlPath, ["disable", unit], [0, 1]);
    await runCommandV1(systemctlPath, ["daemon-reload"]);
    return;
  }

  const launchctlPath = "/bin/launchctl";
  const serviceTarget = `system/${context.serviceLabel}`;
  if (action === "activate") {
    await runCommandV1(launchctlPath, [
      "bootstrap",
      "system",
      context.descriptorPath,
    ]);
    await runCommandV1(launchctlPath, ["enable", serviceTarget]);
    return;
  }
  if (action === "restart") {
    await runCommandV1(launchctlPath, ["bootout", serviceTarget], [0, 3]);
    await runCommandV1(launchctlPath, [
      "bootstrap",
      "system",
      context.descriptorPath,
    ]);
    return;
  }
  // launchctl exits 3 when the exact service target is already absent.
  await runCommandV1(launchctlPath, ["bootout", serviceTarget], [0, 3]);
}

function mintCapabilityV1(
  state: ProviderServiceInstallationPrivilegeStateInternalV1,
): ProviderServiceInstallationPrivilegeCapabilityInternalV1 {
  const capability = Object.freeze(Object.create(null)) as
    ProviderServiceInstallationPrivilegeCapabilityInternalV1;
  privilegeStatesInternalV1.set(capability, Object.freeze({ ...state }));
  return capability;
}

/** Production-only mint. Public lifecycle options cannot replace this host. */
export function mintProviderServiceInstallationPrivilegeInternalV1():
  ProviderServiceInstallationPrivilegeCapabilityInternalV1 {
  if (
    typeof process.geteuid !== "function" ||
    process.geteuid() !== 0 ||
    typeof process.getegid !== "function" ||
    !validPlatformV1(process.platform)
  ) {
    throw new TypeError("provider service lifecycle requires root authority");
  }
  const authorityGid = process.getegid();
  const authorityPlatform = process.platform;
  return mintCapabilityV1({
    authorityUid: 0,
    authorityGid,
    platform: authorityPlatform,
    controlService: controlProductionServiceV1,
    allowTestDescriptorOverride: false,
    recheckAuthority() {
      if (
        typeof process.geteuid !== "function" ||
        process.geteuid() !== 0 ||
        typeof process.getegid !== "function" ||
        process.getegid() !== authorityGid ||
        process.platform !== authorityPlatform
      ) {
        throw new TypeError("provider service lifecycle authority changed");
      }
    },
  });
}

/** Deep-import-only test seam. The capability itself remains opaque. */
export function mintProviderServiceInstallationPrivilegeForTestInternalV1(
  host: ProviderServiceInstallationPrivilegeTestHostInternalV1,
): ProviderServiceInstallationPrivilegeCapabilityInternalV1 {
  if (
    host === null ||
    typeof host !== "object" ||
    !validOwnerV1(host.authorityUid) ||
    !validOwnerV1(host.authorityGid) ||
    !validPlatformV1(host.platform) ||
    typeof host.controlService !== "function"
  ) {
    throw new TypeError("provider service lifecycle test privilege is invalid");
  }
  return mintCapabilityV1({
    ...host,
    allowTestDescriptorOverride: true,
    recheckAuthority() {},
  });
}

export function requireProviderServiceInstallationPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
): Readonly<ProviderServiceInstallationPrivilegeStateInternalV1> {
  if (
    capability === null ||
    (typeof capability !== "object" && typeof capability !== "function")
  ) {
    throw new TypeError("provider service lifecycle privilege is invalid");
  }
  const state = privilegeStatesInternalV1.get(capability as object);
  if (state === undefined) {
    throw new TypeError("provider service lifecycle privilege is invalid");
  }
  state.recheckAuthority();
  return state;
}
