import { createHash, generateKeyPairSync } from "node:crypto";
import {
  access,
  chmod,
  chown,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  rename,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import {
  canonicalizeJcsSafeIntegerV1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { afterEach, describe, expect, it } from "vitest";

import {
  PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
  PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1,
  PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1,
  PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
  PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
  classifyProviderServiceAtomicStageMetadataForTestInternalV1,
  doctorProviderServiceInstallationWithPrivilegeInternalV1,
  installProviderServiceInstallationWithPrivilegeInternalV1,
  rollbackProviderServiceInstallationWithPrivilegeInternalV1,
  uninstallProviderServiceInstallationWithPrivilegeInternalV1,
  upgradeProviderServiceInstallationWithPrivilegeInternalV1,
  writeProviderServiceAtomicOwnedFileForTestInternalV1,
} from "../src/provider-service-installation-lifecycle.js";
import {
  mintProviderServiceInstallationPrivilegeForTestInternalV1,
  type ProviderServiceInstallationControlActionInternalV1,
  type ProviderServiceInstallationDurablePhaseInternalV1,
  type ProviderServiceInstallationPrivilegeCapabilityInternalV1,
} from "../src/provider-service-installation-privilege-internal.js";
import {
  createProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffPayloadV1,
  type ProviderServicePlatformV1,
} from "../src/service-handoff.js";

const INSTALLATION_IDENTITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const BINARY_DIGEST_V1 = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);
const BINARY_DIGEST_V2 = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);
const BINARY_DIGEST_V3 = ContentDigestV1Schema.parse(
  `sha256:${"e".repeat(64)}`,
);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"d".repeat(64)}`,
);
const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:lifecycle-test",
);
const INITIALIZATION_NONCE = LowerHex32V1Schema.parse(
  "000102030405060708090a0b0c0d0e0f",
);
const INSTALLATION_IDENTITY_GENERATION_ID =
  InstallationIdentityGenerationIdV1Schema.parse(
    "installation-identity-generation:4fe634940e20afac35e02d",
  );
const INSTALLATION_IDENTITY_KEY_CHECK_TOKEN = KeyedStateTokenV1Schema.parse(
  "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
);
const INSTALLATION_IDENTITY_KEY = Uint8Array.from(
  { length: 32 },
  (_value, index) => index,
);

const roots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
});

interface LifecycleFixtureV1 {
  readonly root: string;
  readonly installationRoot: string;
  readonly runtimeRoot: string;
  readonly configPath: string;
  readonly descriptorPath: string;
  readonly identityPath: string;
  readonly readinessPath: string;
  readonly authPath: string;
  readonly signingPath: string;
  readonly privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
  readonly configV1: ProviderServiceHandoffConfigV1;
  readonly configV2: ProviderServiceHandoffConfigV1;
  readonly configV3: ProviderServiceHandoffConfigV1;
  readonly capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1;
  readonly actions: ProviderServiceInstallationControlActionInternalV1[];
}

function platformV1(): ProviderServicePlatformV1 {
  return process.platform === "darwin" ? "darwin" : "linux";
}

async function fixtureV1(options?: {
  readonly failActivate?: boolean;
  readonly separateAuthorityArtifactParents?: boolean;
  readonly separateRuntimeParent?: boolean;
  readonly controlService?: (
    action: ProviderServiceInstallationControlActionInternalV1,
  ) => void | Promise<void>;
  readonly afterDurablePhase?: (
    phase: ProviderServiceInstallationDurablePhaseInternalV1,
  ) => void | Promise<void>;
}): Promise<LifecycleFixtureV1> {
  const createdRoot = await mkdtemp(join(
    process.cwd(),
    ".uc-provider-lifecycle-",
  ));
  roots.add(createdRoot);
  const root = await realpath(createdRoot);
  await chmod(root, 0o700);
  const authorityUid = process.getuid?.() ?? 501;
  const authorityGid = process.getgid?.() ?? authorityUid;
  const principalUid = authorityUid > 0 ? authorityUid : 501;
  const principalGid = authorityGid > 0 ? authorityGid : principalUid;
  const installationRoot = join(root, "authority");
  const runtimeParent = options?.separateRuntimeParent === true
    ? join(root, "runtime-parent")
    : root;
  if (options?.separateRuntimeParent === true) {
    await mkdir(runtimeParent, { mode: 0o700 });
  }
  const runtimeRoot = join(runtimeParent, "runtime");
  const configParent = options?.separateAuthorityArtifactParents === true
    ? join(root, "config-parent")
    : root;
  const descriptorParent = options?.separateAuthorityArtifactParents === true
    ? join(root, "descriptor-parent")
    : root;
  if (options?.separateAuthorityArtifactParents === true) {
    await mkdir(configParent, { mode: 0o700 });
    await mkdir(descriptorParent, { mode: 0o700 });
  }
  const configPath = join(configParent, "provider-config.json");
  const descriptorPath = join(
    descriptorParent,
    platformV1() === "darwin" ? "provider.plist" : "provider.service",
  );
  const identityPath = join(runtimeRoot, "installation-identity.key");
  const readinessPath = join(runtimeRoot, "readiness.json");
  const authPath = join(runtimeRoot, "auth.key");
  const signingPath = join(runtimeRoot, "signing.key");
  const privateKey = generateKeyPairSync("ed25519").privateKey;
  const payload: ProviderServiceHandoffPayloadV1 = {
    schemaVersion: 1,
    profile: "understand_code_provider_service_handoff_payload_v1",
    platform: platformV1(),
    serviceLabel: platformV1() === "darwin"
      ? "com.openai.understand-code.lifecycle-test"
      : "understand-code-lifecycle-test",
    providerId: PROVIDER_ID,
    principal: {
      kind: "dedicated_os_principal",
      name: "ucprovider",
      uid: principalUid,
      gid: principalGid,
    },
    runtimeRoot,
    socketPath: join(runtimeRoot, "provider.sock"),
    executablePath: process.execPath,
    configPath,
    authKeyPath: authPath,
    readinessPath,
    signingKeyPath: signingPath,
    installationIdentityCustody: {
      keyPath: identityPath,
      initializationNonce: INITIALIZATION_NONCE,
      installationIdentityGenerationId:
        INSTALLATION_IDENTITY_GENERATION_ID,
      keyCheckToken: INSTALLATION_IDENTITY_KEY_CHECK_TOKEN,
    },
    installationIdentityDigest: INSTALLATION_IDENTITY_DIGEST,
    binaryDigest: BINARY_DIGEST_V1,
    capabilityDigest: CAPABILITY_DIGEST,
  };
  const configV1 = createProviderServiceHandoffConfigV1({
    payload,
    privateKey,
  });
  const configV2 = createProviderServiceHandoffConfigV1({
    payload: {
      ...payload,
      binaryDigest: BINARY_DIGEST_V2,
    },
    privateKey,
  });
  const configV3 = createProviderServiceHandoffConfigV1({
    payload: {
      ...payload,
      binaryDigest: BINARY_DIGEST_V3,
    },
    privateKey,
  });
  const actions: ProviderServiceInstallationControlActionInternalV1[] = [];
  const capability =
    mintProviderServiceInstallationPrivilegeForTestInternalV1({
      authorityUid,
      authorityGid,
      platform: platformV1(),
      controlService(action) {
        actions.push(action);
        if (options?.failActivate === true && action === "activate") {
          throw new Error("simulated activation failure");
        }
        return options?.controlService?.(action);
      },
      afterDurablePhase(phase) {
        return options?.afterDurablePhase?.(phase);
      },
    });
  return {
    root,
    installationRoot,
    runtimeRoot,
    configPath,
    descriptorPath,
    identityPath,
    readinessPath,
    authPath,
    signingPath,
    privateKey,
    configV1,
    configV2,
    configV3,
    capability,
    actions,
  };
}

async function installFixtureV1(
  fixture: LifecycleFixtureV1,
): Promise<Awaited<ReturnType<
  typeof installProviderServiceInstallationWithPrivilegeInternalV1
>>> {
  return installProviderServiceInstallationWithPrivilegeInternalV1(
    fixture.capability,
    {
      installationRoot: fixture.installationRoot,
      expectedRuntimeRoot: fixture.runtimeRoot,
      config: fixture.configV1,
      privateKey: fixture.privateKey,
      installationIdentityKey: INSTALLATION_IDENTITY_KEY,
      descriptorPath: fixture.descriptorPath,
    },
  );
}

async function expectMissingV1(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
}

function atomicPublishStagingPathV1(path: string): string {
  return join(dirname(path), `.${basename(path)}.provider-service-publish-v1`);
}

function lifecycleLockBytesV1(pid: number, fill: number): Buffer {
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    profile: PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1,
    pid,
    nonce: `base64url:${Buffer.alloc(16, fill).toString("base64url")}`,
  });
  const contentDigest = `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerV1([
      "understand-code-provider-service-installation-lock-v1",
      payload,
    ]))
    .digest("hex")}`;
  return Buffer.from(
    `${canonicalizeJcsSafeIntegerV1({ payload, contentDigest })}\n`,
    "utf8",
  );
}

function lifecycleRecoveryClaimBytesV1(input: {
  readonly breakerPid: number;
  readonly observedLockPid: number;
  readonly observedLockNonceFill: number;
  readonly observedLockDev: number;
  readonly observedLockIno: number;
}): Buffer {
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    profile:
      "understand_code_provider_service_installation_lock_recovery_claim_v1",
    breakerPid: input.breakerPid,
    breakerNonce: `base64url:${Buffer.alloc(16, 9).toString("base64url")}`,
    observedLockPid: input.observedLockPid,
    observedLockNonce:
      `base64url:${Buffer.alloc(16, input.observedLockNonceFill).toString("base64url")}`,
    observedLockDev: input.observedLockDev,
    observedLockIno: input.observedLockIno,
  });
  const contentDigest = `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerV1([
      "understand-code-provider-service-installation-lock-recovery-claim-v1",
      payload,
    ]))
    .digest("hex")}`;
  return Buffer.from(
    `${canonicalizeJcsSafeIntegerV1({ payload, contentDigest })}\n`,
    "utf8",
  );
}

function definitelyDeadPidV1(): number {
  for (const candidate of [0x7fffffff, 99_999_999, 9_999_999]) {
    try {
      process.kill(candidate, 0);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { readonly code?: unknown }).code === "ESRCH"
      ) return candidate;
    }
  }
  throw new Error("test host has no definitely absent pid candidate");
}

function deferredV1(): Readonly<{
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}> {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return Object.freeze({ promise, resolve: resolvePromise });
}

describe("provider service owned-manifest lifecycle", () => {
  it("installs, upgrades, rolls back, and uninstalls while retaining durable identity state", async () => {
    const fixture = await fixtureV1();
    const missing = await doctorProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    expect(missing).toMatchObject({
      ok: true,
      status: "not_installed",
      authority: "read_only",
      strongWrites: "locked",
    });

    const installed = await installFixtureV1(fixture);
    expect(installed).toMatchObject({
      status: "installed",
      authority: "read_only",
      strongWrites: "locked",
    });
    expect(Object.isFrozen(fixture.capability)).toBe(true);
    expect(Object.keys(fixture.capability)).toEqual([]);
    expect((await stat(fixture.installationRoot)).mode & 0o777).toBe(0o700);
    const manifestPath = join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
    );
    const manifestBytes = await readFile(manifestPath, "utf8");
    expect(manifestBytes.endsWith("\n")).toBe(true);
    expect(manifestBytes.indexOf("\n")).toBe(manifestBytes.length - 1);

    const authBefore = await readFile(fixture.authPath);
    const signingBefore = await readFile(fixture.signingPath);
    const identityBefore = await readFile(fixture.identityPath);
    const identityInodeBefore = (await stat(fixture.identityPath)).ino;
    const durablePath = join(fixture.runtimeRoot, "durable-state.bin");
    await writeFile(durablePath, "retained durable state", { mode: 0o600 });
    await writeFile(fixture.readinessPath, "ephemeral-v1", { mode: 0o600 });
    await writeFile(fixture.readinessPath, "ephemeral-v2", { mode: 0o600 });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });

    const upgraded = await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
        config: fixture.configV2,
      },
    );
    expect(upgraded).toMatchObject({
      status: "updated",
      rollbackAvailable: true,
      strongWrites: "locked",
    });
    expect(await readFile(fixture.authPath)).toEqual(authBefore);
    expect(await readFile(fixture.signingPath)).toEqual(signingBefore);
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
    expect(await readFile(durablePath, "utf8")).toBe("retained durable state");

    const rolledBack = await rollbackProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    expect(rolledBack).toMatchObject({
      status: "rolled_back",
      payloadDigest: fixture.configV1.payloadDigest,
      strongWrites: "locked",
    });
    const restoredConfig = JSON.parse(
      await readFile(fixture.configPath, "utf8"),
    ) as ProviderServiceHandoffConfigV1;
    expect(restoredConfig.payloadDigest).toBe(fixture.configV1.payloadDigest);
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: "healthy",
      rollbackAvailable: false,
    });

    const uninstalled = await uninstallProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    expect(uninstalled).toMatchObject({
      status: "removed_with_retained_state",
      retainedState: [
        "runtime_root",
        "provider_durable_state",
        "installation_identity_key",
      ],
      strongWrites: "locked",
    });
    expect(await readFile(durablePath, "utf8")).toBe("retained durable state");
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
    await expectMissingV1(fixture.configPath);
    await expectMissingV1(fixture.descriptorPath);
    await expectMissingV1(fixture.authPath);
    await expectMissingV1(fixture.signingPath);
    await expectMissingV1(fixture.readinessPath);
    await expectMissingV1(manifestPath);
    const reinstalled = await installFixtureV1(fixture);
    expect(reinstalled).toMatchObject({ status: "installed" });
    expect((await stat(fixture.identityPath)).ino).toBe(identityInodeBefore);
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
    expect(await readFile(durablePath, "utf8")).toBe("retained durable state");
    expect(await readFile(fixture.authPath)).not.toEqual(authBefore);
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "removed_with_retained_state" });
    expect(fixture.actions).toEqual([
      "activate",
      "restart",
      "restart",
      "deactivate",
      "activate",
      "deactivate",
    ]);
  });

  it("cleans a failed fresh install, including pre-commit Identity custody", async () => {
    const fixture = await fixtureV1({ failActivate: true });
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "refused",
      reason: "service_control_failed",
      strongWrites: "locked",
    });
    await expectMissingV1(fixture.installationRoot);
    await expectMissingV1(fixture.runtimeRoot);
    await expectMissingV1(fixture.identityPath);
    await expectMissingV1(fixture.authPath);
    await expectMissingV1(fixture.signingPath);
    await expectMissingV1(fixture.configPath);
    await expectMissingV1(fixture.descriptorPath);
  });

  it("recovers journal-first runtime-root creation cuts without orphan state", async () => {
    for (const phase of [
      "install_journal_published",
      "install_runtime_root_marker_published",
    ] as const) {
      let cutPending = true;
      const fixture = await fixtureV1({
        afterDurablePhase(observed) {
          if (observed === phase && cutPending) {
            cutPending = false;
            throw new Error(`simulated ${phase} process cut`);
          }
        },
      });
      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "recovery_required",
        reason: "install_files_pending",
      });
      await expectMissingV1(fixture.runtimeRoot);
      await expect(
        installFixtureV1(fixture),
      ).resolves.toMatchObject({ status: "installed" });
      await expectMissingV1(join(
        dirname(fixture.runtimeRoot),
        `.${basename(fixture.runtimeRoot)}.provider-service-runtime-root-creation-v1`,
      ));
      await expect(
        doctorProviderServiceInstallationWithPrivilegeInternalV1(
          fixture.capability,
          {
            installationRoot: fixture.installationRoot,
            expectedRuntimeRoot: fixture.runtimeRoot,
          },
        ),
      ).resolves.toMatchObject({ ok: true, status: "healthy" });
    }
  });

  it("refuses a same-uid runtime-root swap at files-pending install custody", async () => {
    let swapPending = true;
    let fixture!: LifecycleFixtureV1;
    const movedRoot = "runtime-install-files-pending-pinned";
    const foreignBytes = Buffer.from("foreign-install-files-pending");
    fixture = await fixtureV1({
      async afterDurablePhase(phase) {
        if (
          phase !== "install_runtime_root_custody_acquired" ||
          !swapPending
        ) return;
        swapPending = false;
        await rename(fixture.runtimeRoot, join(fixture.root, movedRoot));
        await mkdir(fixture.runtimeRoot, { mode: 0o700 });
        await writeFile(fixture.authPath, foreignBytes, { mode: 0o600 });
        await writeFile(fixture.readinessPath, foreignBytes, { mode: 0o600 });
      },
    });

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
      reason: "install_cleanup_pending",
    });
    await expect(readFile(fixture.authPath)).resolves.toEqual(foreignBytes);
    await expect(readFile(fixture.readinessPath)).resolves.toEqual(foreignBytes);
    await expect(access(join(fixture.root, movedRoot))).resolves.toBeUndefined();
    await expectMissingV1(fixture.configPath);
    await expectMissingV1(fixture.descriptorPath);
    await expect(access(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
    ))).resolves.toBeUndefined();
  });

  it("refuses a same-uid runtime-root swap during lost-activate compensation", async () => {
    let failFirstActivation = true;
    let custodyCount = 0;
    let fixture!: LifecycleFixtureV1;
    const movedRoot = "runtime-install-compensation-pinned";
    const foreignBytes = Buffer.from("foreign-install-compensation");
    fixture = await fixtureV1({
      controlService(action) {
        if (action === "activate" && failFirstActivation) {
          failFirstActivation = false;
          throw new Error("simulated lost activation");
        }
      },
      async afterDurablePhase(phase) {
        if (phase !== "install_runtime_root_custody_acquired") return;
        custodyCount += 1;
        if (custodyCount !== 2) return;
        await rename(fixture.runtimeRoot, join(fixture.root, movedRoot));
        await mkdir(fixture.runtimeRoot, { mode: 0o700 });
        await writeFile(fixture.authPath, foreignBytes, { mode: 0o600 });
        await writeFile(fixture.readinessPath, foreignBytes, { mode: 0o600 });
      },
    });

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
      reason: "install_cleanup_pending",
    });
    expect(custodyCount).toBe(2);
    await expect(readFile(fixture.authPath)).resolves.toEqual(foreignBytes);
    await expect(readFile(fixture.readinessPath)).resolves.toEqual(foreignBytes);
    await expect(access(join(
      fixture.root,
      movedRoot,
      basename(fixture.authPath),
    ))).resolves.toBeUndefined();
    await expect(access(fixture.configPath)).resolves.toBeUndefined();
    await expect(access(fixture.descriptorPath)).resolves.toBeUndefined();
    await expect(access(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
    ))).resolves.toBeUndefined();
  });

  it("converges fresh install cleanup cuts after root and marker removal", async () => {
    for (const cut of [
      "install_runtime_root_removed",
      "install_runtime_root_marker_removed",
    ] as const) {
      let failFirstActivation = true;
      let cutPending = true;
      const fixture = await fixtureV1({
        controlService(action) {
          if (action === "activate" && failFirstActivation) {
            failFirstActivation = false;
            throw new Error("simulated initial activation failure");
          }
        },
        afterDurablePhase(phase) {
          if (phase === cut && cutPending) {
            cutPending = false;
            throw new Error(`simulated ${cut} process cut`);
          }
        },
      });
      const markerPath = join(
        dirname(fixture.runtimeRoot),
        `.${basename(fixture.runtimeRoot)}.provider-service-runtime-root-creation-v1`,
      );
      const journalPath = join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
      );

      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "recovery_required",
        reason: "install_cleanup_pending",
      });
      await expectMissingV1(fixture.runtimeRoot);
      await expect(access(journalPath)).resolves.toBeUndefined();
      if (cut === "install_runtime_root_removed") {
        await expect(access(markerPath)).resolves.toBeUndefined();
      } else {
        await expectMissingV1(markerPath);
      }
      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "refused",
        reason: "service_control_failed",
      });
      await expectMissingV1(journalPath);
      await expectMissingV1(markerPath);
      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "installed",
      });
    }
  });

  it("converges exact atomic publish cuts and refuses independent same-byte inodes", async () => {
    for (const cut of ["stage_only", "published_pair", "incomplete"] as const) {
      let cutPending = true;
      const fixture = await fixtureV1({
        afterDurablePhase(phase) {
          if (phase === "install_journal_published" && cutPending) {
            cutPending = false;
            throw new Error("simulated process cut before the first artifact");
          }
        },
      });
      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "recovery_required",
      });
      const stagingPath = atomicPublishStagingPathV1(fixture.configPath);
      const configBytes = Buffer.from(`${JSON.stringify(fixture.configV1)}\n`);
      if (cut === "stage_only") {
        await writeFile(stagingPath, configBytes, { mode: 0o644 });
      } else if (cut === "published_pair") {
        await writeFile(fixture.configPath, configBytes, { mode: 0o644 });
        await link(fixture.configPath, stagingPath);
      } else {
        await writeFile(stagingPath, configBytes.subarray(0, 7), { mode: 0o400 });
      }
      await expect(installFixtureV1(fixture)).resolves.toMatchObject({
        status: "installed",
      });
      await expectMissingV1(stagingPath);
    }

    let cutPending = true;
    const fixture = await fixtureV1({
      afterDurablePhase(phase) {
        if (phase === "install_journal_published" && cutPending) {
          cutPending = false;
          throw new Error("simulated independent-inode process cut");
        }
      },
    });
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
    });
    const stagingPath = atomicPublishStagingPathV1(fixture.configPath);
    const configBytes = Buffer.from(`${JSON.stringify(fixture.configV1)}\n`);
    await writeFile(fixture.configPath, configBytes, { mode: 0o644 });
    await writeFile(stagingPath, configBytes, { mode: 0o644 });
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
      reason: "install_cleanup_pending",
    });
    await expect(readFile(fixture.configPath)).resolves.toEqual(configBytes);
    await expect(readFile(stagingPath)).resolves.toEqual(configBytes);
  });

  it("converges distinct authority/principal metadata cuts without adopting foreign bytes", async () => {
    const synthetic = {
      authorityUid: 0,
      authorityGid: 0,
      ownerUid: 501,
      ownerGid: 20,
      finalMode: 0o600,
    } as const;
    expect(classifyProviderServiceAtomicStageMetadataForTestInternalV1({
      ...synthetic,
      observedUid: 0,
      observedGid: 0,
      observedMode: 0o600,
    })).toBe("complete_owner");
    expect(classifyProviderServiceAtomicStageMetadataForTestInternalV1({
      ...synthetic,
      observedUid: 501,
      observedGid: 20,
      observedMode: 0o400,
    })).toBe("complete_mode");
    expect(classifyProviderServiceAtomicStageMetadataForTestInternalV1({
      ...synthetic,
      observedUid: 777,
      observedGid: 20,
      observedMode: 0o400,
    })).toBe("invalid");

    const authorityGid = process.getgid?.() ?? 20;
    const principalGid = process.getgroups?.().find((gid) => gid !== authorityGid);
    if (principalGid === undefined) return;
    const fixture = await fixtureV1();
    const ownerUid = process.getuid?.() ?? 501;
    const bytes = Buffer.from("journal-pinned-stage-bytes", "utf8");
    for (const transition of ["authority_final_mode", "principal_0400"] as const) {
      const target = join(fixture.root, `atomic-${transition}`);
      const staging = atomicPublishStagingPathV1(target);
      await writeFile(staging, bytes, { mode: 0o400 });
      if (transition === "authority_final_mode") {
        await chmod(staging, 0o600);
      } else {
        await chown(staging, ownerUid, principalGid);
      }
      await writeProviderServiceAtomicOwnedFileForTestInternalV1(
        fixture.capability,
        {
          path: target,
          bytes,
          mode: 0o600,
          ownerUid,
          ownerGid: principalGid,
          replace: false,
        },
      );
      const metadata = await stat(target);
      expect(metadata.uid).toBe(ownerUid);
      expect(metadata.gid).toBe(principalGid);
      expect(metadata.mode & 0o777).toBe(0o600);
      await expect(readFile(target)).resolves.toEqual(bytes);
      await expectMissingV1(staging);
    }

    for (const transition of ["authority_final_mode", "principal_0400"] as const) {
      const target = join(fixture.root, `foreign-${transition}`);
      const staging = atomicPublishStagingPathV1(target);
      const foreign = Buffer.from("foreign-stage-bytes", "utf8");
      await writeFile(staging, foreign, { mode: 0o400 });
      if (transition === "authority_final_mode") {
        await chmod(staging, 0o600);
      } else {
        await chown(staging, ownerUid, principalGid);
      }
      await expect(
        writeProviderServiceAtomicOwnedFileForTestInternalV1(
          fixture.capability,
          {
            path: target,
            bytes,
            mode: 0o600,
            ownerUid,
            ownerGid: principalGid,
            replace: false,
          },
        ),
      ).rejects.toMatchObject({ code: "path_conflict" });
      await expect(readFile(staging)).resolves.toEqual(foreign);
      await expectMissingV1(target);
    }
  });

  it("retains reused Identity and durable state when reinstall activation fails", async () => {
    let failReinstall = false;
    const fixture = await fixtureV1({
      controlService(action) {
        if (action === "activate" && failReinstall) {
          throw new Error("simulated reinstall activation failure");
        }
      },
    });
    await installFixtureV1(fixture);
    const identityBefore = await readFile(fixture.identityPath);
    const identityInodeBefore = (await stat(fixture.identityPath)).ino;
    const durablePath = join(fixture.runtimeRoot, "durable-reinstall.bin");
    await writeFile(durablePath, "retained", { mode: 0o600 });
    await uninstallProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    failReinstall = true;
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "refused",
      reason: "service_control_failed",
    });
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
    expect((await stat(fixture.identityPath)).ino).toBe(identityInodeBefore);
    expect(await readFile(durablePath, "utf8")).toBe("retained");
    await expectMissingV1(fixture.authPath);
    await expectMissingV1(fixture.signingPath);
    failReinstall = false;
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "installed",
    });
  });

  it("converges a retained Identity publish pair only after install custody", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const identityBefore = await readFile(fixture.identityPath);
    const identityInodeBefore = (await stat(fixture.identityPath)).ino;
    await uninstallProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    const identityStage = atomicPublishStagingPathV1(fixture.identityPath);
    await link(fixture.identityPath, identityStage);

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "installed",
    });
    await expectMissingV1(identityStage);
    await expect(readFile(fixture.identityPath)).resolves.toEqual(identityBefore);
    expect((await stat(fixture.identityPath)).ino).toBe(identityInodeBefore);
  });

  it("keeps retained Identity and foreign paths on a pre-custody root swap", async () => {
    let swapPending = false;
    let fixture!: LifecycleFixtureV1;
    const movedRoot = "runtime-retained-identity-pinned";
    const foreignIdentity = Buffer.alloc(32, 0xa5);
    const foreignAuth = Buffer.from("foreign-pre-custody-auth");
    fixture = await fixtureV1({
      async afterDurablePhase(phase) {
        if (phase !== "install_journal_published" || !swapPending) return;
        swapPending = false;
        await rename(fixture.runtimeRoot, join(fixture.root, movedRoot));
        await mkdir(fixture.runtimeRoot, { mode: 0o700 });
        await writeFile(fixture.identityPath, foreignIdentity, { mode: 0o600 });
        await writeFile(fixture.authPath, foreignAuth, { mode: 0o600 });
      },
    });
    await installFixtureV1(fixture);
    const identityBefore = await readFile(fixture.identityPath);
    await uninstallProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    const identityStage = atomicPublishStagingPathV1(fixture.identityPath);
    await link(fixture.identityPath, identityStage);
    swapPending = true;

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
      reason: "install_cleanup_pending",
    });
    await expect(readFile(fixture.identityPath)).resolves.toEqual(foreignIdentity);
    await expect(readFile(fixture.authPath)).resolves.toEqual(foreignAuth);
    const movedIdentity = join(fixture.root, movedRoot, basename(fixture.identityPath));
    const movedStage = atomicPublishStagingPathV1(movedIdentity);
    await expect(readFile(movedIdentity)).resolves.toEqual(identityBefore);
    await expect(readFile(movedStage)).resolves.toEqual(identityBefore);
    expect((await stat(movedIdentity)).ino).toBe((await stat(movedStage)).ino);
  });

  it("recovers an install when activation may have succeeded but its reply is lost", async () => {
    let activationReplyLost = true;
    let firstDeactivationReplyLost = true;
    const fixture = await fixtureV1({
      controlService(action) {
        if (action === "activate" && activationReplyLost) {
          activationReplyLost = false;
          throw new Error("activation side effect completed but reply was lost");
        }
        if (action === "deactivate" && firstDeactivationReplyLost) {
          firstDeactivationReplyLost = false;
          throw new Error("deactivation state is unknown");
        }
      },
    });

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "recovery_required",
      reason: "deactivation_unconfirmed",
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: "recovery_required",
      reason: "install_control_invoked",
    });

    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "installed",
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });
    expect(fixture.actions).toEqual([
      "activate",
      "deactivate",
      "deactivate",
      "activate",
    ]);
  });

  it("recovers first and second upgrades across snapshot and restart cuts", async () => {
    let snapshotCutPending = true;
    let restartCutPending = false;
    let fixture!: LifecycleFixtureV1;
    fixture = await fixtureV1({
      async afterDurablePhase(phase) {
        if (phase === "upgrade_snapshot_published" && snapshotCutPending) {
          snapshotCutPending = false;
          const rollbackPath = join(
            fixture.installationRoot,
            PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
          );
          await link(rollbackPath, atomicPublishStagingPathV1(rollbackPath));
          throw new Error("simulated process death after snapshot publish");
        }
      },
      controlService(action) {
        if (action === "restart" && restartCutPending) {
          // Model a service-manager side effect followed by loss of its reply.
          restartCutPending = false;
          throw new Error("simulated lost restart reply");
        }
      },
    });
    await expect(installFixtureV1(fixture)).resolves.toMatchObject({
      status: "installed",
    });
    const authBefore = await readFile(fixture.authPath);
    const signingBefore = await readFile(fixture.signingPath);
    const identityBefore = await readFile(fixture.identityPath);
    const durablePath = join(fixture.runtimeRoot, "durable-state.bin");
    await writeFile(durablePath, "survives recovery", { mode: 0o600 });

    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV2,
        },
      ),
    ).resolves.toMatchObject({
      status: "recovery_required",
      reason: "upgrade_files_pending",
    });
    await expect(
      access(join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
      )),
    ).resolves.toBeUndefined();
    await expect(
      access(atomicPublishStagingPathV1(join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
      ))),
    ).resolves.toBeUndefined();
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "recovery_required" });

    await expect(
      rollbackProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "control_recovery_pending",
    });
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV2,
        },
      ),
    ).resolves.toMatchObject({
      status: "updated",
      payloadDigest: fixture.configV2.payloadDigest,
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });
    await expectMissingV1(atomicPublishStagingPathV1(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    )));

    restartCutPending = true;
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV3,
        },
      ),
    ).resolves.toMatchObject({
      status: "recovery_required",
      reason: "restart_unconfirmed",
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "recovery_required" });
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV3,
        },
      ),
    ).resolves.toMatchObject({
      status: "updated",
      fromPayloadDigest: fixture.configV2.payloadDigest,
      payloadDigest: fixture.configV3.payloadDigest,
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });
    expect(await readFile(fixture.authPath)).toEqual(authBefore);
    expect(await readFile(fixture.signingPath)).toEqual(signingBefore);
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
    expect(await readFile(durablePath, "utf8")).toBe("survives recovery");
  });

  it("converges snapshot-pinned rollback config and manifest stages", async () => {
    for (const cut of [
      "config_stage_only",
      "config_metadata_cut",
      "manifest_published_pair",
    ] as const) {
      const fixture = await fixtureV1();
      await installFixtureV1(fixture);
      await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV2,
        },
      );
      const rollbackPath = join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
      );
      const rollback = JSON.parse(await readFile(rollbackPath, "utf8")) as {
        readonly payload: {
          readonly files: readonly [
            { readonly bytes: `base64url:${string}` },
            { readonly bytes: `base64url:${string}` },
          ];
          readonly fromManifest: unknown;
        };
      };
      const configBytes = Buffer.from(
        rollback.payload.files[0].bytes.slice("base64url:".length),
        "base64url",
      );
      const descriptorBytes = Buffer.from(
        rollback.payload.files[1].bytes.slice("base64url:".length),
        "base64url",
      );
      const manifestPath = join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
      );
      const manifestBytes = Buffer.from(
        `${canonicalizeJcsSafeIntegerV1(rollback.payload.fromManifest)}\n`,
      );
      let stagingPath: string;
      if (cut === "config_stage_only" || cut === "config_metadata_cut") {
        stagingPath = atomicPublishStagingPathV1(fixture.configPath);
        await writeFile(stagingPath, configBytes, {
          mode: cut === "config_metadata_cut" ? 0o400 : 0o644,
        });
      } else {
        await writeFile(fixture.configPath, configBytes, { mode: 0o644 });
        await writeFile(fixture.descriptorPath, descriptorBytes, { mode: 0o644 });
        await writeFile(manifestPath, manifestBytes, { mode: 0o600 });
        stagingPath = atomicPublishStagingPathV1(manifestPath);
        await link(manifestPath, stagingPath);
      }

      const result = await rollbackProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      );
      expect(result, `${cut}: ${JSON.stringify(result)}`).toMatchObject({
        status: "rolled_back",
      });
      await expectMissingV1(stagingPath);
    }
  });

  it("converges pinned rollback publication cuts and retries stage-first deletion", async () => {
    for (const cut of ["stage_only", "published_pair", "metadata_cut"] as const) {
      const fixture = await fixtureV1();
      await installFixtureV1(fixture);
      await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV2,
        },
      );
      const rollbackPath = join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
      );
      const stagingPath = atomicPublishStagingPathV1(rollbackPath);
      const bytes = await readFile(rollbackPath);
      if (cut === "published_pair") {
        await link(rollbackPath, stagingPath);
      } else {
        await unlink(rollbackPath);
        await writeFile(stagingPath, bytes, {
          mode: cut === "metadata_cut" ? 0o400 : 0o600,
        });
      }
      await expect(
        rollbackProviderServiceInstallationWithPrivilegeInternalV1(
          fixture.capability,
          {
            installationRoot: fixture.installationRoot,
            expectedRuntimeRoot: fixture.runtimeRoot,
          },
        ),
      ).resolves.toMatchObject({ status: "rolled_back" });
      await expectMissingV1(rollbackPath);
      await expectMissingV1(stagingPath);
    }

    let armRemovalPair = false;
    let cutAfterStageRemoval = true;
    let deletionFixture!: LifecycleFixtureV1;
    deletionFixture = await fixtureV1({
      async controlService(action) {
        if (action === "restart" && armRemovalPair) {
          armRemovalPair = false;
          const rollbackPath = join(
            deletionFixture.installationRoot,
            PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
          );
          await link(rollbackPath, atomicPublishStagingPathV1(rollbackPath));
        }
      },
      afterDurablePhase(phase) {
        if (phase === "rollback_publish_stage_removed" && cutAfterStageRemoval) {
          cutAfterStageRemoval = false;
          throw new Error("simulated cut after rollback stage removal");
        }
      },
    });
    await installFixtureV1(deletionFixture);
    await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      deletionFixture.capability,
      {
        installationRoot: deletionFixture.installationRoot,
        expectedRuntimeRoot: deletionFixture.runtimeRoot,
        config: deletionFixture.configV2,
      },
    );
    armRemovalPair = true;
    await expect(
      rollbackProviderServiceInstallationWithPrivilegeInternalV1(
        deletionFixture.capability,
        {
          installationRoot: deletionFixture.installationRoot,
          expectedRuntimeRoot: deletionFixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "partial" });
    const deletionRollbackPath = join(
      deletionFixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    );
    await expect(access(deletionRollbackPath)).resolves.toBeUndefined();
    expect((await stat(deletionRollbackPath)).nlink).toBe(1);
    await expectMissingV1(atomicPublishStagingPathV1(deletionRollbackPath));
    await expect(
      rollbackProviderServiceInstallationWithPrivilegeInternalV1(
        deletionFixture.capability,
        {
          installationRoot: deletionFixture.installationRoot,
          expectedRuntimeRoot: deletionFixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "rolled_back" });

    const uninstallFixture = await fixtureV1();
    await installFixtureV1(uninstallFixture);
    await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      uninstallFixture.capability,
      {
        installationRoot: uninstallFixture.installationRoot,
        expectedRuntimeRoot: uninstallFixture.runtimeRoot,
        config: uninstallFixture.configV2,
      },
    );
    const uninstallRollbackPath = join(
      uninstallFixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    );
    const uninstallStage = atomicPublishStagingPathV1(uninstallRollbackPath);
    const uninstallRollbackBytes = await readFile(uninstallRollbackPath);
    await unlink(uninstallRollbackPath);
    await writeFile(uninstallStage, uninstallRollbackBytes, { mode: 0o600 });
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        uninstallFixture.capability,
        {
          installationRoot: uninstallFixture.installationRoot,
          expectedRuntimeRoot: uninstallFixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "removed_with_retained_state" });
    await expectMissingV1(uninstallStage);
  });

  it("refuses foreign canonical baselines beside valid pinned stages", async () => {
    const rollbackFixture = await fixtureV1();
    await installFixtureV1(rollbackFixture);
    await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      rollbackFixture.capability,
      {
        installationRoot: rollbackFixture.installationRoot,
        expectedRuntimeRoot: rollbackFixture.runtimeRoot,
        config: rollbackFixture.configV2,
      },
    );
    const rollbackPath = join(
      rollbackFixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    );
    const rollback = JSON.parse(await readFile(rollbackPath, "utf8")) as {
      readonly payload: {
        readonly files: readonly [{ readonly bytes: `base64url:${string}` }];
      };
    };
    const expectedConfig = Buffer.from(
      rollback.payload.files[0].bytes.slice("base64url:".length),
      "base64url",
    );
    const configStage = atomicPublishStagingPathV1(rollbackFixture.configPath);
    const foreignConfig = Buffer.from("foreign-but-correctly-shaped-owner-mode\n");
    await writeFile(configStage, expectedConfig, { mode: 0o644 });
    await writeFile(rollbackFixture.configPath, foreignConfig, { mode: 0o644 });
    await expect(
      rollbackProviderServiceInstallationWithPrivilegeInternalV1(
        rollbackFixture.capability,
        {
          installationRoot: rollbackFixture.installationRoot,
          expectedRuntimeRoot: rollbackFixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      status: "refused",
      reason: "rollback_snapshot_invalid",
    });
    await expect(readFile(rollbackFixture.configPath)).resolves.toEqual(foreignConfig);
    await expect(readFile(configStage)).resolves.toEqual(expectedConfig);

    const foreignFixture = await fixtureV1();
    await installFixtureV1(foreignFixture);
    await upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      foreignFixture.capability,
      {
        installationRoot: foreignFixture.installationRoot,
        expectedRuntimeRoot: foreignFixture.runtimeRoot,
        config: foreignFixture.configV2,
      },
    );
    const foreignRollback = await readFile(join(
      foreignFixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    ));
    let injectForeignBaseline = true;
    let upgradeFixture!: LifecycleFixtureV1;
    upgradeFixture = await fixtureV1({
      async afterDurablePhase(phase) {
        if (phase !== "upgrade_snapshot_published" || !injectForeignBaseline) return;
        injectForeignBaseline = false;
        const path = join(
          upgradeFixture.installationRoot,
          PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
        );
        const expected = await readFile(path);
        await unlink(path);
        await writeFile(path, foreignRollback, { mode: 0o600 });
        await writeFile(atomicPublishStagingPathV1(path), expected, { mode: 0o600 });
        throw new Error("simulated foreign rollback canonical at journal cut");
      },
    });
    await installFixtureV1(upgradeFixture);
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        upgradeFixture.capability,
        {
          installationRoot: upgradeFixture.installationRoot,
          expectedRuntimeRoot: upgradeFixture.runtimeRoot,
          config: upgradeFixture.configV2,
        },
      ),
    ).resolves.toMatchObject({ status: "recovery_required" });
    const upgradeRollbackPath = join(
      upgradeFixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    );
    const upgradeStage = atomicPublishStagingPathV1(upgradeRollbackPath);
    const expectedStage = await readFile(upgradeStage);
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        upgradeFixture.capability,
        {
          installationRoot: upgradeFixture.installationRoot,
          expectedRuntimeRoot: upgradeFixture.runtimeRoot,
          config: upgradeFixture.configV2,
        },
      ),
    ).resolves.toMatchObject({ status: "recovery_required" });
    await expect(readFile(upgradeRollbackPath)).resolves.toEqual(foreignRollback);
    await expect(readFile(upgradeStage)).resolves.toEqual(expectedStage);
  });

  it("pins runtime-root custody across same-uid swaps without deleting foreign paths", async () => {
    for (const boundary of ["before_custody", "after_custody"] as const) {
      let swapPending = true;
      let fixture!: LifecycleFixtureV1;
      const movedRootName = `runtime-pinned-${boundary}`;
      const foreignBytes = Buffer.from(`foreign-${boundary}`);
      const swapRuntimeRoot = async (): Promise<void> => {
        if (!swapPending) return;
        swapPending = false;
        await rename(fixture.runtimeRoot, join(fixture.root, movedRootName));
        await mkdir(fixture.runtimeRoot, { mode: 0o700 });
        await writeFile(fixture.authPath, foreignBytes, { mode: 0o600 });
        await writeFile(fixture.readinessPath, foreignBytes, { mode: 0o600 });
      };
      fixture = await fixtureV1({
        async controlService(action) {
          if (boundary === "before_custody" && action === "deactivate") {
            await swapRuntimeRoot();
          }
        },
        async afterDurablePhase(phase) {
          if (
            boundary === "after_custody" &&
            phase === "uninstall_runtime_root_custody_acquired"
          ) {
            await swapRuntimeRoot();
          }
        },
      });
      await installFixtureV1(fixture);
      const originalAuth = await readFile(fixture.authPath);
      await writeFile(fixture.readinessPath, "original-readiness", {
        mode: 0o600,
      });

      await expect(
        uninstallProviderServiceInstallationWithPrivilegeInternalV1(
          fixture.capability,
          {
            installationRoot: fixture.installationRoot,
            expectedRuntimeRoot: fixture.runtimeRoot,
          },
        ),
      ).resolves.toMatchObject({
        status: "recovery_required",
        reason: "uninstall_cleanup_pending",
        removedPaths: [],
      });
      await expect(readFile(fixture.authPath)).resolves.toEqual(foreignBytes);
      await expect(readFile(fixture.readinessPath)).resolves.toEqual(foreignBytes);
      await expect(readFile(join(
        fixture.root,
        movedRootName,
        basename(fixture.authPath),
      ))).resolves.toEqual(originalAuth);
      await expect(access(fixture.configPath)).resolves.toBeUndefined();
      await expect(access(join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
      ))).resolves.toBeUndefined();
    }
  });

  it("fails closed when the runtime root direct parent becomes writable", async () => {
    const fixture = await fixtureV1({ separateRuntimeParent: true });
    await installFixtureV1(fixture);
    const authBefore = await readFile(fixture.authPath);
    await chmod(dirname(fixture.runtimeRoot), 0o777);
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "tampered" });
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "refused" });
    await expect(readFile(fixture.authPath)).resolves.toEqual(authBefore);
    await expect(access(fixture.configPath)).resolves.toBeUndefined();
  });

  it("rejects pre-existing installation roots beneath unsafe authority ancestry", async () => {
    const directFixture = await fixtureV1();
    await mkdir(directFixture.installationRoot, { mode: 0o700 });
    await chmod(directFixture.root, 0o777);
    await expect(installFixtureV1(directFixture)).rejects.toMatchObject({
      code: "invalid_target",
    });
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        directFixture.capability,
        {
          installationRoot: directFixture.installationRoot,
          expectedRuntimeRoot: directFixture.runtimeRoot,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_target" });

    const ancestorFixture = await fixtureV1();
    const unsafeGrandparent = join(ancestorFixture.root, "unsafe-grandparent");
    const safeParent = join(unsafeGrandparent, "safe-parent");
    const nestedInstallationRoot = join(safeParent, "authority");
    await mkdir(unsafeGrandparent, { mode: 0o700 });
    await mkdir(safeParent, { mode: 0o700 });
    await mkdir(nestedInstallationRoot, { mode: 0o700 });
    await chmod(unsafeGrandparent, 0o777);
    await expect(
      installProviderServiceInstallationWithPrivilegeInternalV1(
        ancestorFixture.capability,
        {
          installationRoot: nestedInstallationRoot,
          expectedRuntimeRoot: ancestorFixture.runtimeRoot,
          config: ancestorFixture.configV1,
          privateKey: ancestorFixture.privateKey,
          installationIdentityKey: INSTALLATION_IDENTITY_KEY,
          descriptorPath: ancestorFixture.descriptorPath,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_target" });
  });

  it("refuses authority artifacts after their direct parent becomes unsafe", async () => {
    const fixture = await fixtureV1({
      separateAuthorityArtifactParents: true,
    });
    await installFixtureV1(fixture);
    const configBefore = await readFile(fixture.configPath);
    const authBefore = await readFile(fixture.authPath);
    await chmod(dirname(fixture.configPath), 0o777);

    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "tampered" });
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "refused" });
    await expect(readFile(fixture.configPath)).resolves.toEqual(configBefore);
    await expect(readFile(fixture.authPath)).resolves.toEqual(authBefore);
    await expectMissingV1(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
    ));
  });

  it("reports a live lifecycle lock as busy while another operation owns it", async () => {
    const restartEntered = deferredV1();
    const releaseRestart = deferredV1();
    let blockRestart = false;
    const fixture = await fixtureV1({
      async controlService(action) {
        if (action === "restart" && blockRestart) {
          restartEntered.resolve();
          await releaseRestart.promise;
        }
      },
    });
    await installFixtureV1(fixture);
    blockRestart = true;
    const upgrading = upgradeProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
        config: fixture.configV2,
      },
    );
    await restartEntered.promise;

    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: "busy",
      reason: "lifecycle_busy",
      artifacts: [expect.objectContaining({
        kind: "lifecycle_lock",
        state: "busy",
      })],
    });
    releaseRestart.resolve();
    await expect(upgrading).resolves.toMatchObject({ status: "updated" });
  });

  it("resumes a dead-breaker claim for a lock left at the hard-link publish cut", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const lockPath = join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1,
    );
    const stagingPath = join(
      fixture.installationRoot,
      "..provider-service-lifecycle.lock.provider-service-publish-v1",
    );
    const claimPath = join(
      fixture.installationRoot,
      ".provider-service-lifecycle.lock.recovery",
    );
    const deadPid = definitelyDeadPidV1();
    await writeFile(lockPath, lifecycleLockBytesV1(deadPid, 7), {
      mode: 0o600,
    });
    await link(lockPath, stagingPath);
    const lockMetadata = await stat(lockPath);
    await writeFile(claimPath, lifecycleRecoveryClaimBytesV1({
      breakerPid: deadPid,
      observedLockPid: deadPid,
      observedLockNonceFill: 7,
      observedLockDev: lockMetadata.dev,
      observedLockIno: lockMetadata.ino,
    }), { mode: 0o600 });

    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });
    await expectMissingV1(lockPath);
    await expectMissingV1(claimPath);
    await expectMissingV1(stagingPath);
  });

  it("never steals a live lock publish pair or an inode with an unknown alias", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const lockPath = join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1,
    );
    const stagingPath = atomicPublishStagingPathV1(lockPath);
    const unknownAliasPath = join(fixture.installationRoot, "unknown-lock-alias");
    const bytes = lifecycleLockBytesV1(process.pid, 6);
    await writeFile(lockPath, bytes, { mode: 0o600 });
    await link(lockPath, stagingPath);
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "busy" });
    await expect(readFile(lockPath)).resolves.toEqual(bytes);
    await expect(readFile(stagingPath)).resolves.toEqual(bytes);

    await link(lockPath, unknownAliasPath);
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "busy" });
    await expect(readFile(lockPath)).resolves.toEqual(bytes);
    await expect(readFile(stagingPath)).resolves.toEqual(bytes);
    await expect(readFile(unknownAliasPath)).resolves.toEqual(bytes);
  });

  it("retires only the pinned stale aliases when a newer lock appears", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const lockPath = join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1,
    );
    const stagingPath = atomicPublishStagingPathV1(lockPath);
    const quarantinePath = join(
      fixture.installationRoot,
      ".provider-service-lifecycle.lock.stale",
    );
    const claimPath = join(
      fixture.installationRoot,
      ".provider-service-lifecycle.lock.recovery",
    );
    const deadPid = definitelyDeadPidV1();
    await writeFile(quarantinePath, lifecycleLockBytesV1(deadPid, 3), {
      mode: 0o600,
    });
    await link(quarantinePath, stagingPath);
    const staleMetadata = await stat(quarantinePath);
    await writeFile(claimPath, lifecycleRecoveryClaimBytesV1({
      breakerPid: deadPid,
      observedLockPid: deadPid,
      observedLockNonceFill: 3,
      observedLockDev: staleMetadata.dev,
      observedLockIno: staleMetadata.ino,
    }), { mode: 0o600 });
    const newerBytes = lifecycleLockBytesV1(process.pid, 4);
    await writeFile(lockPath, newerBytes, { mode: 0o600 });

    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "busy" });
    await expect(readFile(lockPath)).resolves.toEqual(newerBytes);
    await expectMissingV1(stagingPath);
    await expectMissingV1(quarantinePath);
    await expectMissingV1(claimPath);
  });

  it("keeps a recovery gate when its quarantine cannot be proven exact", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const lockPath = join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1,
    );
    const claimPath = join(
      fixture.installationRoot,
      ".provider-service-lifecycle.lock.recovery",
    );
    const quarantinePath = join(
      fixture.installationRoot,
      ".provider-service-lifecycle.lock.stale",
    );
    const deadPid = definitelyDeadPidV1();
    await writeFile(lockPath, lifecycleLockBytesV1(deadPid, 11), {
      mode: 0o600,
    });
    const lockMetadata = await stat(lockPath);
    await writeFile(claimPath, lifecycleRecoveryClaimBytesV1({
      breakerPid: deadPid,
      observedLockPid: deadPid,
      observedLockNonceFill: 11,
      observedLockDev: lockMetadata.dev,
      observedLockIno: lockMetadata.ino,
    }), { mode: 0o600 });
    await writeFile(quarantinePath, "{}\n", { mode: 0o600 });

    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: "busy",
      reason: "lifecycle_busy",
    });
    await expect(access(lockPath)).resolves.toBeUndefined();
    await expect(access(claimPath)).resolves.toBeUndefined();
    await expect(access(quarantinePath)).resolves.toBeUndefined();
  });

  it("resumes uninstall after a confirmed-control deletion cut and preflights foreign paths", async () => {
    let deletionCutPending = true;
    let fixture!: LifecycleFixtureV1;
    fixture = await fixtureV1({
      async afterDurablePhase(phase) {
        if (
          phase === "uninstall_first_artifact_removed" &&
          deletionCutPending
        ) {
          deletionCutPending = false;
          const rollbackPath = join(
            fixture.installationRoot,
            PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
          );
          await link(rollbackPath, atomicPublishStagingPathV1(rollbackPath));
          throw new Error("simulated process death during uninstall cleanup");
        }
      },
    });
    await installFixtureV1(fixture);
    await expect(
      upgradeProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
          config: fixture.configV2,
        },
      ),
    ).resolves.toMatchObject({ status: "updated" });
    const durablePath = join(fixture.runtimeRoot, "durable-state.bin");
    await writeFile(durablePath, "retained across uninstall", { mode: 0o600 });
    const identityBefore = await readFile(fixture.identityPath);

    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      status: "recovery_required",
      reason: "uninstall_cleanup_pending",
      removedPaths: [fixture.configPath],
    });
    // Model the historical canonical-first deletion cut: only the exact
    // journal-pinned deterministic stage survives into uninstall replay.
    await unlink(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    ));
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ ok: false, status: "recovery_required" });

    await symlink(durablePath, fixture.readinessPath);
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      status: "recovery_required",
      removedPaths: [],
      reason: "uninstall_cleanup_pending",
    });
    await expect(access(fixture.descriptorPath)).resolves.toBeUndefined();
    await expect(access(fixture.authPath)).resolves.toBeUndefined();
    await expect(access(fixture.signingPath)).resolves.toBeUndefined();
    await unlink(fixture.readinessPath);

    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({
      status: "removed_with_retained_state",
      retainedState: [
        "runtime_root",
        "provider_durable_state",
        "installation_identity_key",
      ],
    });
    await expectMissingV1(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1,
    ));
    await expectMissingV1(atomicPublishStagingPathV1(join(
      fixture.installationRoot,
      PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    )));
    expect(await readFile(durablePath, "utf8")).toBe("retained across uninstall");
    expect(await readFile(fixture.identityPath)).toEqual(identityBefore);
  });

  it("fails closed on runtime identity mismatch and managed-file tamper", async () => {
    const fixture = await fixtureV1();
    await installFixtureV1(fixture);
    const wrongRuntime = join(fixture.root, "other-runtime");
    await expect(
      doctorProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: wrongRuntime,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: "tampered",
      reason: "manifest_identity_mismatch",
    });

    await writeFile(fixture.configPath, "{}\n", { mode: 0o644 });
    const doctor = await doctorProviderServiceInstallationWithPrivilegeInternalV1(
      fixture.capability,
      {
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
      },
    );
    expect(doctor).toMatchObject({ ok: false, status: "tampered" });
    expect(doctor.artifacts).toContainEqual(expect.objectContaining({
      kind: "service_config",
      state: "modified",
    }));
    await expect(
      uninstallProviderServiceInstallationWithPrivilegeInternalV1(
        fixture.capability,
        {
          installationRoot: fixture.installationRoot,
          expectedRuntimeRoot: fixture.runtimeRoot,
        },
      ),
    ).resolves.toMatchObject({ status: "refused" });
    await expect(access(fixture.configPath)).resolves.toBeUndefined();
    await expect(
      access(join(
        fixture.installationRoot,
        PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
      )),
    ).resolves.toBeUndefined();
  });
});
