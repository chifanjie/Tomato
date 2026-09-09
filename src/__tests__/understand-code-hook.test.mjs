import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hookPath = resolve("hooks/understand-code-hook.mjs");
const temporaryDirectories = [];

afterEach(async () => {
  while (temporaryDirectories.length > 0) {
    await rm(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

/** Creates a workspace with an optional `.understand-code/` state directory. */
async function workspace({ config, meta, graph = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), "uc-hook-"));
  temporaryDirectories.push(root);
  const stateDir = join(root, ".understand-code");
  await mkdir(stateDir, { recursive: true });
  if (config !== undefined) {
    await writeFile(join(stateDir, "config.json"), config);
  }
  if (meta !== undefined) {
    await writeFile(join(stateDir, "meta.json"), meta);
  }
  if (graph) {
    await writeFile(join(stateDir, "knowledge-graph.json"), "{}");
  }
  return root;
}

function runHook(cwd, mode, toolInput = "") {
  return execFileSync(process.execPath, [hookPath, mode], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TOOL_INPUT: toolInput },
  });
}

describe("understand-code hook", () => {
  it("stays silent when autoUpdate is disabled even if another flag is true", async () => {
    // The previous `grep '"autoUpdate".*true'` matched this line.
    const root = await workspace({
      config: '{"autoUpdate": false, "language": "zh", "deterministic": true}',
    });

    expect(runHook(root, "post-tool-use", "git commit -m 'x'")).toBe("");
  });

  it("prompts on a commit when autoUpdate is enabled", async () => {
    const root = await workspace({ config: '{"autoUpdate": true}' });

    expect(runHook(root, "post-tool-use", "git commit -m 'x'")).toContain(
      "[understand-code]",
    );
  });

  it("recognises commits behind git flags such as -C <path>", async () => {
    const root = await workspace({ config: '{"autoUpdate": true}' });

    expect(runHook(root, "post-tool-use", "git -C /repo commit -m 'x'")).toContain(
      "[understand-code]",
    );
  });

  it("ignores Bash commands that are not history-creating", async () => {
    const root = await workspace({ config: '{"autoUpdate": true}' });

    expect(runHook(root, "post-tool-use", "git status")).toBe("");
  });

  it("stays silent and exits cleanly when meta.json is corrupt", async () => {
    const root = await workspace({
      config: '{"autoUpdate": true}',
      meta: "not json at all",
    });

    expect(runHook(root, "session-start")).toBe("");
  });

  it("stays silent when no graph has been generated yet", async () => {
    const root = await workspace({ config: '{"autoUpdate": true}', graph: false });

    expect(runHook(root, "post-tool-use", "git commit -m 'x'")).toBe("");
  });

  it("reports staleness when the recorded commit differs from HEAD", async () => {
    const root = await workspace({
      config: '{"autoUpdate": true}',
      meta: '{"gitCommitHash": "0000000000000000000000000000000000000000"}',
    });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit",
      "-q", "--allow-empty", "-m", "seed"], { cwd: root });

    expect(runHook(root, "session-start")).toContain("[understand-code]");
  });
});
