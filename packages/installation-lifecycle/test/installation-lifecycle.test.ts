import { mkdtemp, readFile, stat, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTALLATION_CONFIG_FILE,
  INSTALLATION_MANIFEST_FILE,
  INSTALLATION_WRAPPER_FILE,
  doctorInstallationV1,
  installInstallationV1,
  uninstallInstallationV1,
} from "../src/index.js";

const temporaryRoots: string[] = [];

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
});
