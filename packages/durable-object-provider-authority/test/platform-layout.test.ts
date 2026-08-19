import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { userInfo } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "../src/platform-layout.js";

const workerPath = fileURLToPath(
  new URL("./production-layout-worker.mjs", import.meta.url),
);
const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function resolveInHostileProcessV1(
  label: string,
): Promise<ProviderAcceptanceAuthorityLayoutInternalV1> {
  const hostileRoot = await mkdtemp(
    join(tmpdir(), `provider-authority-hostile-${label}-`),
  );
  fixtureRoots.add(hostileRoot);
  const child = spawn(process.execPath, [workerPath], {
    cwd: hostileRoot,
    env: {
      ...process.env,
      HOME: join(hostileRoot, "attacker-home"),
      XDG_STATE_HOME: join(hostileRoot, "attacker-xdg-state"),
      TMPDIR: join(hostileRoot, "attacker-tmp"),
      TMP: join(hostileRoot, "attacker-tmp-short"),
      TEMP: join(hostileRoot, "attacker-temp"),
      PWD: join(hostileRoot, "attacker-pwd"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const exit = await new Promise<Readonly<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolvePromise) => {
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
  expect(exit, Buffer.concat(stderr).toString("utf8")).toEqual({
    code: 0,
    signal: null,
  });
  return JSON.parse(
    Buffer.concat(stdout).toString("utf8"),
  ) as ProviderAcceptanceAuthorityLayoutInternalV1;
}

describe("provider Acceptance production OS locator", () => {
  it("ignores hostile HOME, XDG, cwd, and tmp environment values", async () => {
    const [left, right] = await Promise.all([
      resolveInHostileProcessV1("left"),
      resolveInHostileProcessV1("right"),
    ]);
    expect(left).toEqual(right);

    const account = userInfo({ encoding: "utf8" });
    const expectedRoot = process.platform === "darwin"
      ? join(
          account.homedir,
          "Library",
          "Application Support",
          "understand-code",
        )
      : join(account.homedir, ".local", "state", "understand-code");
    expect(left.authorityRoot).toBe(expectedRoot);
    expect(left.authorityUid).toBe(account.uid);
    expect(left.authorityGid).toBe(account.gid);
    for (const path of [
      ...left.directories,
      left.installationIdentityKeyPath,
      left.installationIdentityInitializationMarkerPath,
      left.installationIdentityStatePath,
      left.canonicalSnapshotPath,
      left.deterministicSnapshotStagePath,
      left.canonicalPublicationPinPath,
      left.deterministicPublicationPinStagePath,
      left.transactionLockPath,
      left.transactionLockStagePath,
      left.transactionLockRecoveryClaimPath,
      left.transactionLockQuarantinePath,
    ]) {
      expect(path === expectedRoot || path.startsWith(`${expectedRoot}/`))
        .toBe(true);
      expect(path).not.toContain("attacker-");
    }
  });
});
