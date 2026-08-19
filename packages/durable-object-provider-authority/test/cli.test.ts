import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { userInfo } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fixtureRoots = new Set<string>();
const account = userInfo({ encoding: "utf8" });
const productionRoot = process.platform === "darwin"
  ? join(
      account.homedir,
      "Library",
      "Application Support",
      "understand-code",
    )
  : join(account.homedir, ".local", "state", "understand-code");

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function runCliV1(argumentsV1: readonly string[]) {
  const hostileRoot = await mkdtemp(
    join(tmpdir(), "provider-authority-cli-hostile-"),
  );
  fixtureRoots.add(hostileRoot);
  const child = spawn(process.execPath, [cliPath, ...argumentsV1], {
    cwd: hostileRoot,
    env: {
      ...process.env,
      HOME: join(hostileRoot, "attacker-home"),
      XDG_STATE_HOME: join(hostileRoot, "attacker-xdg"),
      TMPDIR: join(hostileRoot, "attacker-tmp"),
      PROVIDER_ACCEPTANCE_ROOT: join(hostileRoot, "attacker-root"),
      PROVIDER_ACCEPTANCE_KEY: "do-not-print-this-secret",
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
  return {
    ...exit,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
    hostileRoot,
  };
}

describe("provider Acceptance authority doctor-only CLI", () => {
  it.each([
    { name: "no arguments", argumentsV1: [] },
    { name: "unknown current command", argumentsV1: ["current"] },
    { name: "extra doctor argument", argumentsV1: ["doctor", "extra"] },
    {
      name: "caller supplied root",
      argumentsV1: ["doctor", "--root", "/tmp/attacker-root"],
    },
    {
      name: "caller supplied key",
      argumentsV1: ["--key", "do-not-print-this-secret"],
    },
  ])("rejects $name with exact redacted output and exit 2", async (testCase) => {
    const result = await runCliV1(testCase.argumentsV1);
    expect(result).toMatchObject({
      code: 2,
      signal: null,
      stderr: "",
      stdout: `${JSON.stringify({
        status: "invalid_arguments",
        authority: "installation_owner_candidate",
        strongWrites: "locked",
      })}\n`,
    });
    expect(result.stdout).not.toContain(result.hostileRoot);
    expect(result.stdout).not.toContain("do-not-print-this-secret");
    expect(result.stdout).not.toContain("hmac-sha256:");
  });

  it.runIf(!existsSync(productionRoot))(
    "reports an unprovisioned fixed production root with redacted output and exit 1",
    async () => {
      const result = await runCliV1(["doctor"]);
      expect(result).toMatchObject({
        code: 1,
        signal: null,
        stderr: "",
        stdout: `${JSON.stringify({
          status: "unprovisioned",
          authority: "installation_owner_candidate",
          strongWrites: "locked",
          namespace: "unavailable",
        })}\n`,
      });
      expect(result.stdout).not.toContain(productionRoot);
      expect(result.stdout).not.toContain(result.hostileRoot);
      expect(result.stdout).not.toContain("do-not-print-this-secret");
      expect(result.stdout).not.toContain("hmac-sha256:");
    },
  );
});
