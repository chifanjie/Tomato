import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTALLATION_CONFIG_FILE,
  INSTALLATION_MANIFEST_FILE,
  INSTALLATION_ROLLBACK_FILE,
  INSTALLATION_WRAPPER_FILE,
  doctorInstallationV1,
  installInstallationV1,
  rollbackInstallationV1,
  uninstallInstallationV1,
  upgradeInstallationV1,
} from "../src/index.js";

const temporaryRoots: string[] = [];
const execFile = promisify(execFileCallback);

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

describe("installation lifecycle", () => {
  it("installs owned files and Doctor reports a healthy installation", async () => {
    const root = await temporaryRoot();
    const installed = await installInstallationV1({ root, version: "3.0.0-alpha.1" });

    expect(installed.status).toBe("installed");
    const doctor = await doctorInstallationV1({ root });
    expect(doctor.ok).toBe(true);
    expect(doctor.status).toBe("healthy");
    expect(doctor.files.every((file) => file.state === "ok")).toBe(true);
    expect(await stat(path.join(root, INSTALLATION_WRAPPER_FILE))).toMatchObject({
      mode: expect.any(Number),
    });
    const config = JSON.parse(
      await readFile(path.join(root, INSTALLATION_CONFIG_FILE), "utf8"),
    ) as { marker?: string; mcpServers?: Record<string, unknown> };
    expect(config.marker).toBe("understand-code-owned-v1");
    expect(config.mcpServers?.["understand-code"]).toBeDefined();
    expect(await stat(path.join(root, INSTALLATION_MANIFEST_FILE))).toBeDefined();
  });

  it("installs and validates a Claude host projection", async () => {
    const root = await temporaryRoot();
    const installed = await installInstallationV1({ root, host: "claude" });

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

    const recordPath = path.join(root, "argv-record.json");
    const fakeCli = path.join(root, "fake-cli.mjs");
    await writeFile(
      fakeCli,
      `#!/usr/bin/env node\nimport { writeFile } from "node:fs/promises";\nawait writeFile(${JSON.stringify(recordPath)}, JSON.stringify(process.argv.slice(2)));\n`,
      { mode: 0o755 },
    );
    await execFile(
      path.join(installed.root, INSTALLATION_WRAPPER_FILE),
      ["--root", installed.root],
      { env: { ...process.env, UNDERSTAND_CODE_CLI: fakeCli } },
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
    await installInstallationV1({ root });
    const wrapper = path.join(root, INSTALLATION_WRAPPER_FILE);
    await writeFile(wrapper, `${await readFile(wrapper, "utf8")}# user edit\n`);

    const doctor = await doctorInstallationV1({ root });
    expect(doctor.status).toBe("tampered");
    const result = await uninstallInstallationV1({ root });
    expect(result.status).toBe("refused");
    expect(result.refusedPaths).toContain(INSTALLATION_WRAPPER_FILE);
    expect(await stat(wrapper)).toBeDefined();
  });

  it("is idempotent and removes an untouched installation", async () => {
    const root = await temporaryRoot();
    const first = await installInstallationV1({ root, version: "3.0.0-alpha.1" });
    const second = await installInstallationV1({ root, version: "3.0.0-alpha.1" });
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
    await installInstallationV1({
      root,
      version: "1.0.0",
      cliCommand: "understand-code-v1",
    });

    const upgraded = await upgradeInstallationV1({
      root,
      version: "2.0.0",
      cliCommand: "understand-code-v2",
    });
    expect(upgraded).toMatchObject({
      status: "updated",
      fromVersion: "1.0.0",
      version: "2.0.0",
      rollbackAvailable: true,
    });
    expect(await stat(path.join(root, INSTALLATION_ROLLBACK_FILE))).toBeDefined();

    const rolledBack = await rollbackInstallationV1({ root });
    expect(rolledBack).toMatchObject({ status: "rolled_back", version: "1.0.0" });
    expect(await doctorInstallationV1({ root })).toMatchObject({
      status: "healthy",
      version: "1.0.0",
    });
    await expect(stat(path.join(root, INSTALLATION_ROLLBACK_FILE))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const config = JSON.parse(
      await readFile(path.join(root, INSTALLATION_CONFIG_FILE), "utf8"),
    ) as { mcpServers?: Record<string, { command?: string }> };
    expect(config.mcpServers?.["understand-code"]?.command).toBe("understand-code-v1");
  });

  it("refuses rollback when the durable snapshot is tampered", async () => {
    const root = await temporaryRoot();
    await installInstallationV1({ root, version: "1.0.0" });
    await upgradeInstallationV1({ root, version: "2.0.0" });
    const rollbackPath = path.join(root, INSTALLATION_ROLLBACK_FILE);
    await writeFile(rollbackPath, `${await readFile(rollbackPath, "utf8")}\nuser-edit\n`);

    const result = await rollbackInstallationV1({ root });
    expect(result.status).toBe("refused");
    expect(result.refusedPaths).toContain(INSTALLATION_ROLLBACK_FILE);
    expect(await doctorInstallationV1({ root })).toMatchObject({ status: "tampered" });
  });
});
