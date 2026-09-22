import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { installPackagedHost } from "../src/host-install.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

async function hostExecutable(host) {
  const explicit = process.env[`UNDERSTAND_CODE_${host.toUpperCase()}_CLI`];
  const candidates = [explicit, host === "codex"
    ? "/Applications/ChatGPT.app/Contents/Resources/codex"
    : path.join(process.env.HOME ?? "", ".local/bin/claude")].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return await realpath(candidate); }
    catch { /* Try the next known executable without reading Host configuration. */ }
  }
  try {
    const located = execFileSync("sh", ["-c", `command -v ${host}`], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000,
    }).trim();
    await access(located, constants.X_OK);
    return await realpath(located);
  } catch { /* Ordinary package CI may not have either real Host CLI. */ }
  return null;
}

test("install-host helper registers real Host CLIs and runs Doctor in isolated configuration", async (t) => {
  const executables = { codex: await hostExecutable("codex"), claude: await hostExecutable("claude") };
  if (!executables.codex || !executables.claude) {
    if (process.env.UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS === "1") assert.fail("real Codex and Claude CLIs are required");
    t.skip("real Host CLIs unavailable");
    return;
  }
  const sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "understand-install-host-isolated-")));
  const relocated = path.join(sandbox, "package with spaces");
  const distRoot = path.join(relocated, "dist");
  try {
    const hostBin = path.join(sandbox, "host-bin");
    await mkdir(hostBin);
    for (const host of ["codex", "claude"]) await symlink(executables[host], path.join(hostBin, host));
    await mkdir(relocated);
    await cp(path.join(packageRoot, "dist"), distRoot, { recursive: true });
    await cp(path.join(packageRoot, "package.json"), path.join(relocated, "package.json"));
    const version = JSON.parse(await readFile(path.join(relocated, "package.json"), "utf8")).version;
    for (const host of ["codex", "claude"]) {
      const userRoot = path.join(sandbox, `${host}-user`);
      const configRoot = path.join(userRoot, "host-config");
      await mkdir(configRoot, { recursive: true });
      const env = {
        PATH: [hostBin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter),
        HOME: userRoot, USERPROFILE: userRoot,
        XDG_CONFIG_HOME: path.join(userRoot, ".config"), XDG_CACHE_HOME: path.join(userRoot, ".cache"),
        XDG_DATA_HOME: path.join(userRoot, ".local/share"),
        CI: "1", NO_COLOR: "1", DISABLE_AUTOUPDATER: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        ...(host === "codex" ? { CODEX_HOME: configRoot } : { CLAUDE_CONFIG_DIR: configRoot }),
      };
      let doctor;
      let installedPath;
      const result = installPackagedHost(host, distRoot, (command, args) => {
        const stdout = execFileSync(command === host ? executables[host] : command, args, {
          cwd: userRoot, env, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
        });
        if (args.includes("doctor")) doctor = JSON.parse(stdout);
        if (host === "codex" && args[0] === "plugin" && args[1] === "add") installedPath = JSON.parse(stdout).installedPath;
      });
      assert.match(result, new RegExp(`Installed and checked ${host}`, "u"));
      assert.equal(doctor.hostRegistration, "registered");
      assert.equal(doctor.status, "healthy");
      assert.equal(doctor.version, version);
      assert.equal(doctor.releaseReady, false);
      if (installedPath) assert.equal(installedPath.startsWith(`${configRoot}${path.sep}`), true);
      t.diagnostic(`${host}: official registration and Doctor healthy in temporary configuration; no login/model call`);
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
