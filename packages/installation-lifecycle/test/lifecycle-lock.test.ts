import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTALLATION_LIFECYCLE_LOCK_FILE,
  INSTALLATION_MANIFEST_FILE,
  downgradeInstallationV1,
  doctorInstallationV1,
  installInstallationV1,
  uninstallInstallationV1,
  upgradeInstallationV1,
} from "../src/index.js";
import type { InstallationOptionsV1 } from "../src/index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporaryRoot(): Promise<string> {
  const parent = await mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "understand-code-lock-"));
  temporaryRoots.push(parent);
  return path.join(parent, "home");
}

function lockPath(root: string): string {
  return path.join(root, INSTALLATION_LIFECYCLE_LOCK_FILE);
}

async function holdLock(
  root: string,
  owner: Readonly<Record<string, unknown>> = {
    schemaVersion: 1,
    nonce: "0123456789abcdef0123456789abcdef",
    pid: process.pid,
    hostname: hostname(),
    acquiredAt: new Date().toISOString(),
  },
): Promise<void> {
  await mkdir(root, { recursive: true });
  const directory = lockPath(root);
  await mkdir(directory, { mode: 0o700 });
  await writeFile(path.join(directory, "owner.json"), `${JSON.stringify(owner)}\n`, {
    mode: 0o600,
  });
}

function fakeNativeKernelPeerBinary(): Buffer {
  const bytes = Buffer.alloc(64);
  if (process.platform === "darwin") {
    Buffer.from([0xcf, 0xfa, 0xed, 0xfe]).copy(bytes);
    bytes.writeUInt32LE(process.arch === "arm64" ? 0x0100000c : 0x01000007, 4);
  } else if (process.platform === "linux") {
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]).copy(bytes);
    bytes[4] = 2;
    bytes[5] = 1;
    bytes.writeUInt16LE(process.arch === "arm64" ? 183 : 62, 18);
  } else {
    throw new Error(`unsupported test platform ${process.platform}`);
  }
  return bytes;
}

async function fakeBundle(version: string, releaseVersion?: string): Promise<string> {
  const parent = await mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "understand-code-lock-bundle-"));
  temporaryRoots.push(parent);
  const bundle = path.join(parent, "understand-code.mjs");
  await writeFile(bundle, `#!/usr/bin/env node\n${releaseVersion === undefined ? "" : `/* understand-code-release-v1 product=understand-code version=${releaseVersion} */\n`}// understand-code-owned-v1\n// ${version}\n`, {
    mode: 0o755,
  });
  const native = path.join(
    parent,
    "native",
    `${process.platform}-${process.arch}`,
    "provider_kernel_peer.node",
  );
  await mkdir(path.dirname(native), { recursive: true });
  await writeFile(native, fakeNativeKernelPeerBinary(), { mode: 0o644 });
  if (releaseVersion !== undefined) {
    const [bundleBytes, nativeBytes] = await Promise.all([
      readFile(bundle),
      readFile(native),
    ]);
    await writeFile(
      path.join(parent, "release-manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "understand-code-alpha-release-v1",
          product: "understand-code",
          package: { name: "@understand-code/preview", version: releaseVersion },
          cli: {
            sha256: `sha256:${createHash("sha256").update(bundleBytes).digest("hex")}`,
          },
          native: {
            tuple: `${process.platform}-${process.arch}`,
            sha256: `sha256:${createHash("sha256").update(nativeBytes).digest("hex")}`,
          },
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    );
  }
  return bundle;
}

describe("installation lifecycle lock", () => {
  it("rejects every mutating entry while a live owner holds the root lock", async () => {
    const root = await temporaryRoot();
    const firstBundle = await fakeBundle("first");
    const nextBundle = await fakeBundle("next");
    await installInstallationV1({ root, version: "2.0.0", cliBundlePath: firstBundle });
    const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
    const before = await readFile(manifestPath);
    await holdLock(root);

    const [install, upgrade, downgrade, uninstall] = await Promise.all([
      installInstallationV1({ root, version: "2.0.0", cliBundlePath: firstBundle }),
      upgradeInstallationV1({ root, version: "3.0.0", cliBundlePath: nextBundle }),
      downgradeInstallationV1({ root, version: "1.0.0", cliBundlePath: firstBundle }),
      uninstallInstallationV1({ root }),
    ]);
    expect(install).toMatchObject({ status: "refused", reason: "installation_busy" });
    expect(upgrade).toMatchObject({ status: "refused", reason: "installation_busy" });
    expect(downgrade).toMatchObject({ status: "refused", reason: "installation_busy" });
    expect(uninstall).toMatchObject({ status: "refused", reason: "installation_busy" });
    expect(await readFile(manifestPath)).toEqual(before);
    expect(await doctorInstallationV1({ root })).toMatchObject({
      ok: false,
      status: "tampered",
      reason: "installation_busy",
    });

    await rm(lockPath(root), { recursive: true, force: true });
    expect(await uninstallInstallationV1({ root })).toMatchObject({ status: "removed" });
  });

  it("serializes same-version callers and leaves no lock after release", async () => {
    const root = await temporaryRoot();
    const bundle = await fakeBundle("same-version");
    await holdLock(root);
    const results = await Promise.all([
      installInstallationV1({ root, version: "1.0.0", cliBundlePath: bundle }),
      installInstallationV1({ root, version: "1.0.0", cliBundlePath: bundle }),
    ]);
    expect(results).toEqual([
      expect.objectContaining({ status: "refused", reason: "installation_busy" }),
      expect.objectContaining({ status: "refused", reason: "installation_busy" }),
    ]);
    await rm(lockPath(root), { recursive: true, force: true });
    await expect(
      installInstallationV1({ root, version: "1.0.0", cliBundlePath: bundle }),
    ).resolves.toMatchObject({ status: "installed" });
    await expect(stat(lockPath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("recovers only a clearly dead same-host owner and refuses malformed stale state", async () => {
    const root = await temporaryRoot();
    const current = await fakeBundle("current", "2.0.0");
    const older = await fakeBundle("older", "1.0.0");
    await installInstallationV1({ root, version: "2.0.0", cliBundlePath: current });
    await holdLock(root, {
      schemaVersion: 1,
      nonce: "deadbeef0123456789abcdef0123456789abcdef",
      pid: 2_147_483_647,
      hostname: hostname(),
      acquiredAt: "2000-01-01T00:00:00.000Z",
    });
    await expect(
      downgradeInstallationV1({ root, version: "1.0.0", cliBundlePath: older }),
    ).resolves.toMatchObject({ status: "updated" });
    await expect(stat(lockPath(root))).rejects.toMatchObject({ code: "ENOENT" });

    await holdLock(root, {});
    const refused = await upgradeInstallationV1({
      root,
      version: "3.0.0",
      cliBundlePath: current,
    });
    expect(refused).toMatchObject({ status: "refused", reason: "installation_busy" });
    expect(await doctorInstallationV1({ root })).toMatchObject({
      ok: false,
      reason: "installation_busy",
    });
    await rm(lockPath(root), { recursive: true, force: true });
    await expect(uninstallInstallationV1({ root })).resolves.toMatchObject({
      status: "removed",
    });
  });

  it("keeps the locked canonical root when a mutable target resolves elsewhere later", async () => {
    const lockedRoot = await temporaryRoot();
    const alternateRoot = await temporaryRoot();
    const firstBundle = await fakeBundle("first");
    const nextBundle = await fakeBundle("next");
    await installInstallationV1({
      root: lockedRoot,
      version: "1.0.0",
      cliBundlePath: firstBundle,
    });
    await installInstallationV1({
      root: alternateRoot,
      version: "1.0.0",
      cliBundlePath: firstBundle,
    });
    const canonicalLockedRoot = await realpath(lockedRoot);

    let targetReads = 0;
    const mutableTarget = {
      get root(): string {
        targetReads += 1;
        return targetReads === 1 ? lockedRoot : alternateRoot;
      },
      version: "2.0.0",
      cliBundlePath: nextBundle,
    } as InstallationOptionsV1;
    const result = await upgradeInstallationV1(mutableTarget);

    expect(result).toMatchObject({ status: "updated", root: canonicalLockedRoot });
    expect(targetReads).toBe(1);
    expect(await doctorInstallationV1({ root: lockedRoot })).toMatchObject({
      status: "healthy",
      version: "2.0.0",
    });
    expect(await doctorInstallationV1({ root: alternateRoot })).toMatchObject({
      status: "healthy",
      version: "1.0.0",
    });
  });
});
