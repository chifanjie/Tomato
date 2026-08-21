import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTALLATION_CONFIG_FILE,
  INSTALLATION_CLI_BUNDLE_FILE,
  INSTALLATION_DASHBOARD_MANIFEST_FILE,
  INSTALLATION_DASHBOARD_ROOT,
  INSTALLATION_MANIFEST_FILE,
  INSTALLATION_NATIVE_KERNEL_PEER_FILE,
  INSTALLATION_REACT_WORKBENCH_UI,
  INSTALLATION_ROLLBACK_FILE,
  INSTALLATION_WORKBENCH_UI,
  INSTALLATION_WRAPPER_FILE,
  doctorInstallationV1,
  installInstallationV1,
  managedLegacyWorkbenchUiAllowedV1,
  rollbackInstallationV1,
  uninstallInstallationV1,
  upgradeInstallationV1,
} from "../src/index.js";

const temporaryRoots: string[] = [];
const execFile = promisify(execFileCallback);
const INSTALLED_DASHBOARD_INDEX_FILE = `${INSTALLATION_DASHBOARD_ROOT}/index.html`;

type FakeDashboardOptions = Readonly<{
  productVersion: string;
  revision: string;
  assetPath: `assets/${string}.js`;
}>;

function contentDigest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "understand-code-install-"));
  temporaryRoots.push(root);
  return path.join(root, "home");
}

function fakeNativeKernelPeerBinary(revision: number): Buffer {
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
  bytes[63] = revision;
  return bytes;
}

async function fakeCliBundle(
  body = "process.exitCode = 0;",
  nativeRevision = 1,
  dashboard?: FakeDashboardOptions,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "understand-code-cli-bundle-"));
  temporaryRoots.push(root);
  const bundlePath = path.join(root, "understand-code.mjs");
  await writeFile(
    bundlePath,
    `#!/usr/bin/env node\n// understand-code-owned-v1\n${body}\n`,
    { mode: 0o755 },
  );
  const nativePath = path.join(
    root,
    "native",
    `${process.platform}-${process.arch}`,
    "provider_kernel_peer.node",
  );
  await mkdir(path.dirname(nativePath), { recursive: true });
  await writeFile(nativePath, fakeNativeKernelPeerBinary(nativeRevision), {
    mode: 0o644,
  });
  if (dashboard !== undefined) {
    const dashboardRoot = path.join(root, "dashboard");
    await mkdir(dashboardRoot, { recursive: true });
    const files = new Map<string, Buffer>([
      [
        "index.html",
        Buffer.from(
          `<!doctype html><html><head><meta name="fixture-release" content="${dashboard.revision}"></head><body><div id="root"></div></body></html>\n`,
          "utf8",
        ),
      ],
      [
        "config.json",
        Buffer.from(
          `${JSON.stringify({ autoUpdate: false, revision: dashboard.revision })}\n`,
          "utf8",
        ),
      ],
      [
        dashboard.assetPath,
        Buffer.from(`globalThis.__dashboardRevision = ${JSON.stringify(dashboard.revision)};\n`, "utf8"),
      ],
    ]);
    const inventory = [...files]
      .map(([filePath, bytes]) => ({
        path: filePath,
        sha256: contentDigest(bytes),
        bytes: bytes.byteLength,
      }))
      .sort((left, right) => left.path.localeCompare(right.path, "en"));
    await Promise.all(
      [...files].map(async ([filePath, bytes]) => {
        const outputPath = path.join(dashboardRoot, filePath);
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, bytes, { mode: 0o644 });
      }),
    );
    await writeFile(
      path.join(root, "dashboard-manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "understand-code-dashboard-bundle-v1",
          productVersion: dashboard.productVersion,
          root: "dashboard",
          fileCount: inventory.length,
          inventorySha256: contentDigest(
            Buffer.from(JSON.stringify(inventory), "utf8"),
          ),
        },
        null,
        2,
      )}\n`,
      { mode: 0o644 },
    );
  }
  return bundlePath;
}

describe("installation lifecycle", () => {
  it("installs owned files and Doctor reports a healthy installation", async () => {
    const root = await temporaryRoot();
    const cliBundlePath = await fakeCliBundle();
    const installed = await installInstallationV1({
      root,
      version: "3.0.0-alpha.1",
      cliBundlePath,
    });

    expect(installed.status).toBe("installed");
    const doctor = await doctorInstallationV1({ root });
    expect(doctor.ok).toBe(true);
    expect(doctor.status).toBe("healthy");
    expect(doctor.files.every((file) => file.state === "ok")).toBe(true);
    expect(await stat(path.join(root, INSTALLATION_WRAPPER_FILE))).toMatchObject({
      mode: expect.any(Number),
    });
    expect(await readFile(path.join(root, INSTALLATION_CLI_BUNDLE_FILE))).toEqual(
      await readFile(cliBundlePath),
    );
    expect(
      await readFile(path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE)),
    ).toEqual(
      await readFile(
        path.join(
          path.dirname(cliBundlePath),
          "native",
          `${process.platform}-${process.arch}`,
          "provider_kernel_peer.node",
        ),
      ),
    );
    expect(
      (await stat(path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE))).mode &
        0o777,
    ).toBe(0o644);
    const config = JSON.parse(
      await readFile(path.join(root, INSTALLATION_CONFIG_FILE), "utf8"),
    ) as { marker?: string; mcpServers?: Record<string, unknown> };
    expect(config.marker).toBe("understand-code-owned-v1");
    expect(config.mcpServers?.["understand-code"]).toBeDefined();
    const manifest = JSON.parse(
      await readFile(path.join(root, INSTALLATION_MANIFEST_FILE), "utf8"),
    ) as { workbenchUi?: string };
    expect(manifest.workbenchUi).toBe(INSTALLATION_WORKBENCH_UI);
    await expect(
      managedLegacyWorkbenchUiAllowedV1(
        path.join(root, INSTALLATION_CLI_BUNDLE_FILE),
      ),
    ).resolves.toBe(true);

    delete manifest.workbenchUi;
    await writeFile(
      path.join(root, INSTALLATION_MANIFEST_FILE),
      `${JSON.stringify(manifest)}\n`,
      { mode: 0o600 },
    );
    expect((await doctorInstallationV1({ root })).status).toBe("healthy");
    await expect(
      managedLegacyWorkbenchUiAllowedV1(
        path.join(root, INSTALLATION_CLI_BUNDLE_FILE),
      ),
    ).resolves.toBe(false);
  });

  it("installs and validates a Claude host projection", async () => {
    const root = await temporaryRoot();
    const recordPath = path.join(root, "argv-record.json");
    const cliBundlePath = await fakeCliBundle(
      `import { writeFile } from "node:fs/promises";\nawait writeFile(${JSON.stringify(recordPath)}, JSON.stringify(process.argv.slice(2)));`,
    );
    const installed = await installInstallationV1({
      root,
      host: "claude",
      cliBundlePath,
    });

    expect(installed.status).toBe("installed");
    const manifest = JSON.parse(
      await readFile(path.join(root, INSTALLATION_MANIFEST_FILE), "utf8"),
    ) as { host?: string };
    expect(manifest.host).toBe("claude");
    const configPath = path.join(root, INSTALLATION_CONFIG_FILE);
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>;
    };
    expect(config.mcpServers?.["understand-code"]).toEqual({
      command: path.join(installed.root, INSTALLATION_WRAPPER_FILE),
      args: ["--root", "${CLAUDE_PROJECT_DIR}"],
    });
    expect((await doctorInstallationV1({ root })).status).toBe("healthy");

    await execFile(
      path.join(installed.root, INSTALLATION_WRAPPER_FILE),
      ["--root", installed.root],
      { env: { PATH: process.env.PATH } },
    );
    expect(JSON.parse(await readFile(recordPath, "utf8"))).toEqual([
      "mcp",
      "--stdio",
      "--root",
      installed.root,
    ]);

    await writeFile(configPath, (await readFile(configPath, "utf8")).replace(
      "${CLAUDE_PROJECT_DIR}",
      "${WORKSPACE_ROOT}",
    ));
    expect((await doctorInstallationV1({ root })).status).toBe("tampered");
  });

  it("refuses uninstall after an owned file is tampered with", async () => {
    const root = await temporaryRoot();
    await installInstallationV1({ root, cliBundlePath: await fakeCliBundle() });
    const bundle = path.join(root, INSTALLATION_CLI_BUNDLE_FILE);
    await writeFile(bundle, `${await readFile(bundle, "utf8")}# user edit\n`);

    const doctor = await doctorInstallationV1({ root });
    expect(doctor.status).toBe("tampered");
    const result = await uninstallInstallationV1({ root });
    expect(result.status).toBe("refused");
    expect(result.refusedPaths).toContain(INSTALLATION_CLI_BUNDLE_FILE);
    expect(await stat(bundle)).toBeDefined();
  });

  it("fails closed when the installed native kernel-peer asset is tampered", async () => {
    const root = await temporaryRoot();
    await installInstallationV1({ root, cliBundlePath: await fakeCliBundle() });
    const nativePath = path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE);
    const nativeBytes = await readFile(nativePath);
    nativeBytes[63] = nativeBytes[63] === 1 ? 2 : 1;
    await writeFile(nativePath, nativeBytes);

    const doctor = await doctorInstallationV1({ root });
    expect(doctor.status).toBe("tampered");
    expect(doctor.files).toContainEqual(
      expect.objectContaining({
        path: INSTALLATION_NATIVE_KERNEL_PEER_FILE,
        state: "modified",
      }),
    );
    const removed = await uninstallInstallationV1({ root });
    expect(removed.status).toBe("refused");
    expect(removed.refusedPaths).toContain(INSTALLATION_NATIVE_KERNEL_PEER_FILE);
    expect(await stat(nativePath)).toBeDefined();
  });

  it("is idempotent and removes an untouched installation", async () => {
    const root = await temporaryRoot();
    const cliBundlePath = await fakeCliBundle();
    const first = await installInstallationV1({
      root,
      version: "3.0.0-alpha.1",
      cliBundlePath,
    });
    const second = await installInstallationV1({
      root,
      version: "3.0.0-alpha.1",
      cliBundlePath,
    });
    expect(second.status).toBe("already_installed");
    expect(second.installationId).toBe(first.installationId);

    const removed = await uninstallInstallationV1({ root });
    expect(removed.status).toBe("removed");
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "not_installed",
      ok: false,
    });
  });

  it("upgrades with a durable snapshot and rolls back to the prior version", async () => {
    const root = await temporaryRoot();
    const firstBundle = await fakeCliBundle("// fixture version 1", 1, {
      productVersion: "1.0.0",
      revision: "dashboard-v1",
      assetPath: "assets/old.js",
    });
    const secondBundle = await fakeCliBundle("// fixture version 2", 2, {
      productVersion: "2.0.0",
      revision: "dashboard-v2",
      assetPath: "assets/new.js",
    });
    const oldAssetPath = `${INSTALLATION_DASHBOARD_ROOT}/assets/old.js`;
    const newAssetPath = `${INSTALLATION_DASHBOARD_ROOT}/assets/new.js`;
    await installInstallationV1({
      root,
      version: "1.0.0",
      cliCommand: "understand-code-v1",
      cliBundlePath: firstBundle,
    });
    const initialManifestBytes = await readFile(
      path.join(root, INSTALLATION_DASHBOARD_MANIFEST_FILE),
    );
    const initialIndexBytes = await readFile(
      path.join(root, INSTALLED_DASHBOARD_INDEX_FILE),
    );
    const initialOldAssetBytes = await readFile(path.join(root, oldAssetPath));
    expect(initialManifestBytes).toEqual(
      await readFile(path.join(path.dirname(firstBundle), "dashboard-manifest.json")),
    );
    expect(initialIndexBytes).toEqual(
      await readFile(path.join(path.dirname(firstBundle), "dashboard/index.html")),
    );
    expect(initialOldAssetBytes).toEqual(
      await readFile(path.join(path.dirname(firstBundle), "dashboard/assets/old.js")),
    );
    const installedManifest = JSON.parse(
      await readFile(path.join(root, INSTALLATION_MANIFEST_FILE), "utf8"),
    ) as { workbenchUi?: string; files: Array<{ path: string }> };
    expect(installedManifest.workbenchUi).toBe(INSTALLATION_REACT_WORKBENCH_UI);
    expect(installedManifest.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        INSTALLATION_DASHBOARD_MANIFEST_FILE,
        `${INSTALLATION_DASHBOARD_ROOT}/config.json`,
        INSTALLED_DASHBOARD_INDEX_FILE,
        oldAssetPath,
      ]),
    );
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "1.0.0",
    });

    const upgraded = await upgradeInstallationV1({
      root,
      version: "2.0.0",
      cliCommand: "understand-code-v2",
      cliBundlePath: secondBundle,
    });
    expect(upgraded).toMatchObject({
      status: "updated",
      fromVersion: "1.0.0",
      version: "2.0.0",
      rollbackAvailable: true,
    });
    expect(await stat(path.join(root, INSTALLATION_ROLLBACK_FILE))).toBeDefined();
    const upgradedManifestBytes = await readFile(
      path.join(root, INSTALLATION_DASHBOARD_MANIFEST_FILE),
    );
    const upgradedIndexBytes = await readFile(
      path.join(root, INSTALLED_DASHBOARD_INDEX_FILE),
    );
    expect(upgradedManifestBytes).toEqual(
      await readFile(path.join(path.dirname(secondBundle), "dashboard-manifest.json")),
    );
    expect(upgradedIndexBytes).toEqual(
      await readFile(path.join(path.dirname(secondBundle), "dashboard/index.html")),
    );
    await expect(stat(path.join(root, oldAssetPath))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(path.join(root, newAssetPath))).toEqual(
      await readFile(path.join(path.dirname(secondBundle), "dashboard/assets/new.js")),
    );
    expect(upgradedManifestBytes).not.toEqual(initialManifestBytes);
    expect(upgradedIndexBytes).not.toEqual(initialIndexBytes);
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "2.0.0",
    });

    const rolledBack = await rollbackInstallationV1({ root });
    expect(rolledBack).toMatchObject({ status: "rolled_back", version: "1.0.0" });
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "1.0.0",
    });
    await expect(stat(path.join(root, INSTALLATION_ROLLBACK_FILE))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(
      await readFile(path.join(root, INSTALLATION_DASHBOARD_MANIFEST_FILE)),
    ).toEqual(initialManifestBytes);
    expect(await readFile(path.join(root, INSTALLED_DASHBOARD_INDEX_FILE))).toEqual(
      initialIndexBytes,
    );
    expect(await readFile(path.join(root, oldAssetPath))).toEqual(
      initialOldAssetBytes,
    );
    await expect(stat(path.join(root, newAssetPath))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const config = JSON.parse(
      await readFile(path.join(root, INSTALLATION_CONFIG_FILE), "utf8"),
    ) as { mcpServers?: Record<string, { command?: string }> };
    expect(config.mcpServers?.["understand-code"]?.command).toBe("understand-code-v1");
    expect(await readFile(path.join(root, INSTALLATION_CLI_BUNDLE_FILE))).toEqual(
      await readFile(firstBundle),
    );
    expect(
      await readFile(path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE)),
    ).toEqual(
      await readFile(
        path.join(
          path.dirname(firstBundle),
          "native",
          `${process.platform}-${process.arch}`,
          "provider_kernel_peer.node",
        ),
      ),
    );
    const restoredManifest = JSON.parse(
      await readFile(path.join(root, INSTALLATION_MANIFEST_FILE), "utf8"),
    ) as { workbenchUi?: string; files: Array<{ path: string }> };
    expect(restoredManifest.workbenchUi).toBe(INSTALLATION_REACT_WORKBENCH_UI);
    const sentinelPath = path.join(root, "user-owned.txt");
    await writeFile(sentinelPath, "preserve me\n", "utf8");
    expect(await uninstallInstallationV1({ root })).toMatchObject({
      status: "removed",
      refusedPaths: [],
    });
    for (const { path: ownedPath } of restoredManifest.files) {
      await expect(stat(path.join(root, ownedPath))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
    for (const relativePath of [
      INSTALLATION_MANIFEST_FILE,
      INSTALLATION_ROLLBACK_FILE,
    ]) {
      await expect(stat(path.join(root, relativePath))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
    expect(await readFile(sentinelPath, "utf8")).toBe("preserve me\n");
  });

  it("rolls back a release-sized bundle without exhausting the snapshot parser", async () => {
    const root = await temporaryRoot();
    const releaseBody = `// ${"x".repeat(4 * 1024 * 1024)}`;
    const firstBundle = await fakeCliBundle(releaseBody, 1);
    const secondBundle = await fakeCliBundle(`${releaseBody}\n// upgraded`, 2);
    await installInstallationV1({
      root,
      version: "1.0.0",
      cliBundlePath: firstBundle,
    });
    expect(
      await upgradeInstallationV1({
        root,
        version: "2.0.0",
        cliBundlePath: secondBundle,
      }),
    ).toMatchObject({ status: "updated", rollbackAvailable: true });

    expect(await rollbackInstallationV1({ root })).toMatchObject({
      status: "rolled_back",
      version: "1.0.0",
    });
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "1.0.0",
    });
  });

  it("migrates a healthy legacy four-file installation and can roll it back", async () => {
    const root = await temporaryRoot();
    await installInstallationV1({
      root,
      version: "1.0.0",
      cliBundlePath: await fakeCliBundle("// legacy fixture", 1),
    });
    const manifestPath = path.join(root, INSTALLATION_MANIFEST_FILE);
    const legacyManifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: Array<{ path: string }>;
    };
    legacyManifest.files = legacyManifest.files.filter(
      (file) => file.path !== INSTALLATION_NATIVE_KERNEL_PEER_FILE,
    );
    await writeFile(manifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`);
    await unlink(path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE));

    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "tampered",
      reason: "native_asset_upgrade_required",
    });
    const upgraded = await upgradeInstallationV1({
      root,
      version: "2.0.0",
      cliBundlePath: await fakeCliBundle("// migrated fixture", 2),
    });
    expect(upgraded.status).toBe("updated");
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "2.0.0",
    });

    const rolledBack = await rollbackInstallationV1({ root });
    expect(rolledBack).toMatchObject({ status: "rolled_back", version: "1.0.0" });
    expect(rolledBack.removedPaths).toContain(INSTALLATION_NATIVE_KERNEL_PEER_FILE);
    await expect(
      stat(path.join(root, INSTALLATION_NATIVE_KERNEL_PEER_FILE)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "tampered",
      reason: "native_asset_upgrade_required",
    });
    expect((await uninstallInstallationV1({ root })).status).toBe("removed");
  });

  it("refuses rollback when the durable snapshot is tampered", async () => {
    const root = await temporaryRoot();
    await installInstallationV1({
      root,
      version: "1.0.0",
      cliBundlePath: await fakeCliBundle("// fixture version 1"),
    });
    await upgradeInstallationV1({
      root,
      version: "2.0.0",
      cliBundlePath: await fakeCliBundle("// fixture version 2"),
    });
    const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
    await writeFile(rollbackPath, `${await readFile(rollbackPath, "utf8")}\nuser-edit\n`);

    const result = await rollbackInstallationV1({ root });
    expect(result.status).toBe("refused");
    expect(result.refusedPaths).toContain(INSTALLATION_ROLLBACK_FILE);
    expect(await doctorInstallationV1({ root })).toMatchObject({ status: "tampered" });
  });
});
