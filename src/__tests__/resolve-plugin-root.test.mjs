import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/resolve-plugin-root.sh");
const repoRoot = resolve(".");
const temporaryDirectories = [];

afterEach(async () => {
  while (temporaryDirectories.length > 0) {
    await rm(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

async function temporaryDirectory(prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  // The resolver prints physical paths (`pwd -P`); on macOS /var is a symlink
  // to /private/var, so compare against the resolved path.
  return realpath(dir);
}

/** Builds a directory that looks like a plugin root to the resolver. */
async function fakePluginRoot() {
  const root = await temporaryDirectory("uc-root-");
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(join(root, "pnpm-workspace.yaml"), "packages: []\n");
  return root;
}

function run(env, cwd = tmpdir()) {
  return execFileSync("bash", [scriptPath], {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: "/nonexistent", ...env },
  }).trim();
}

describe("resolve-plugin-root.sh", () => {
  it("prefers CLAUDE_PLUGIN_ROOT when it is a valid plugin root", async () => {
    const root = await fakePluginRoot();

    expect(run({ CLAUDE_PLUGIN_ROOT: root })).toBe(root);
  });

  it("falls back to its own location when CLAUDE_PLUGIN_ROOT is unset", () => {
    expect(run({})).toBe(repoRoot);
  });

  it("ignores a CLAUDE_PLUGIN_ROOT that is not a plugin root", async () => {
    const notARoot = await temporaryDirectory("uc-empty-");

    // Falls through to self-location rather than trusting the bad value.
    expect(run({ CLAUDE_PLUGIN_ROOT: notARoot })).toBe(repoRoot);
  });

  it("resolves a host skill symlink back to the real checkout", async () => {
    const root = await fakePluginRoot();
    const home = await temporaryDirectory("uc-home-");
    await mkdir(join(root, "skills", "understand"), { recursive: true });
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(
      join(root, "skills", "understand"),
      join(home, ".agents", "skills", "understand"),
    );

    // Copy the script outside any plugin root so self-location cannot win.
    const orphan = await temporaryDirectory("uc-orphan-");
    await mkdir(join(orphan, "scripts"));
    await writeFile(
      join(orphan, "scripts", "resolve-plugin-root.sh"),
      await import("node:fs/promises").then((fs) =>
        fs.readFile(scriptPath, "utf8"),
      ),
    );

    const output = execFileSync(
      "bash",
      [join(orphan, "scripts", "resolve-plugin-root.sh")],
      { cwd: tmpdir(), encoding: "utf8", env: { PATH: process.env.PATH, HOME: home } },
    ).trim();

    expect(output).toBe(root);
  });

  it("exits non-zero with a diagnostic when no root exists", async () => {
    const orphan = await temporaryDirectory("uc-orphan-");
    await mkdir(join(orphan, "scripts"));
    const fs = await import("node:fs/promises");
    await fs.writeFile(
      join(orphan, "scripts", "resolve-plugin-root.sh"),
      await fs.readFile(scriptPath, "utf8"),
    );

    expect(() =>
      execFileSync("bash", [join(orphan, "scripts", "resolve-plugin-root.sh")], {
        cwd: tmpdir(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH, HOME: "/nonexistent" },
      }),
    ).toThrow();
  });
});
