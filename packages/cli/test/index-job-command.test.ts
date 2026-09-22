import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { reconcileStoppedIndexOperation, resolveIndexJobDirectory, runIndexJobCommand } from "../src/index-job-command.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

const exec = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const bin = path.join(packageRoot, "dist/understand-code.mjs");
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const activeJobs: Array<{ directory: string; jobId: string }> = [];

async function cli(args: string[], environment: NodeJS.ProcessEnv = {}) {
  const { stdout } = await exec(process.execPath, [bin, ...args], {
    cwd: packageRoot, timeout: 45_000, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...environment },
  });
  return JSON.parse(stdout.trim()) as Record<string, any>;
}

function record(directory: string, jobId: string) {
  return JSON.parse(readFileSync(path.join(directory, `${jobId}.json`), "utf8"));
}

async function settled(directory: string, jobId: string) {
  await vi.waitFor(async () => {
    await reconcileStoppedIndexOperation(directory);
    expect(["queued", "running"]).not.toContain(record(directory, jobId).status);
  }, { timeout: 45_000, interval: 100 });
  return record(directory, jobId);
}

beforeAll(async () => {
  await exec(process.execPath, ["scripts/build-bundle.mjs"], { cwd: packageRoot, timeout: 120_000 });
}, 120_000);

afterEach(async () => {
  vi.restoreAllMocks();
  // Cancel and join every detached worker before deleting its repository.
  for (const { directory, jobId } of activeJobs.splice(0)) {
    const job = record(directory, jobId);
    if (["queued", "running"].includes(job.status)) {
      writeFileSync(path.join(directory, `${jobId}.cancel`), JSON.stringify({ token: job.token }), { mode: 0o600 });
      await settled(directory, jobId);
    }
  }
  await cleanupTemporaryDirectories();
});

describe("background repository index jobs", () => {
  it("returns a trackable job before indexing and completes after the launcher exits", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const directory = await resolveIndexJobDirectory(root);
    const started = await cli(["index", "--root", root, "--background"]);
    activeJobs.push({ directory, jobId: started.jobId });
    expect(started.status).toBe("queued");
    expect(started.jobId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/u);
    expect(started).not.toHaveProperty("pid");
    expect(started).not.toHaveProperty("token");
    const complete = await settled(directory, started.jobId);
    expect(complete.status, JSON.stringify(complete)).toBe("completed");
    expect(complete.snapshotId).toBeTruthy();
    const status = await cli(["index", "--root", root, "--status", "--job-id", started.jobId]);
    expect(status.snapshotId).toBe(complete.snapshotId);
    expect(status.status).toBe("completed");
    expect(existsSync(path.join(directory, "active.lock"))).toBe(false);
    expect(readFileSync(path.join(root, ".understand-code/index-active-v1.json"), "utf8")).toContain(complete.snapshotId);
    const generations = path.join(root, ".understand-code/index-generations-v1");
    const published = readdirSync(generations).find((name) => /^generation-[0-9a-f]{64}$/u.test(name));
    expect(published).toBeTruthy();
    const graph = JSON.parse(readFileSync(path.join(generations, published!, "knowledge-graph.json"), "utf8"));
    expect(graph.nodes.some((node: { name: string }) => node.name === "task")).toBe(true);
  }, 90_000);

  it("isolates a background worker from ambient Git hooks and Node preloads", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const directory = await resolveIndexJobDirectory(root);
    // Keep helper files outside the indexed source. They only write markers in this temporary repository's private Git state.
    const preloadMarker = path.join(directory, "unexpected-preload");
    const gitMarker = path.join(directory, "unexpected-git-hook");
    const preload = path.join(directory, "preload.cjs");
    const fsmonitor = path.join(directory, "fsmonitor.cjs");
    await writeFile(preload, `if (process.argv.includes("__index-job-run")) require("node:fs").writeFileSync(${JSON.stringify(preloadMarker)}, "invoked");`);
    await writeFile(fsmonitor, `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(gitMarker)}, "invoked"); process.stdout.write("\\0");\n`);
    await chmod(fsmonitor, 0o700);
    const started = await cli(["index", "--root", root], {
      NODE_OPTIONS: `--require=${preload}`,
      GIT_DIR: path.join(root, "ambient-directory-not-authority"),
      GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: fsmonitor,
    });
    activeJobs.push({ directory, jobId: started.jobId });
    expect((await settled(directory, started.jobId)).status).toBe("completed");
    expect(existsSync(preloadMarker)).toBe(false);
    expect(existsSync(gitMarker)).toBe(false);
  }, 90_000);

  it("cancels a detached worker and preserves the previous committed graph", async () => {
    const root = await createGitRepository();
    const previous = readFileSync(path.join(root, ".understand-code/knowledge-graph.json"), "utf8");
    // Keep the worker busy long enough to exercise cancellation between scan units.
    await Promise.all(Array.from({ length: 600 }, (_, index) => writeFile(path.join(root, `src/file-${index}.ts`),
      Array.from({ length: 30 }, (_, n) => `export function f${n}() { return ${n}; }`).join("\n"))));
    const directory = await resolveIndexJobDirectory(root);
    const [started, duplicate] = await Promise.all([cli(["index", "--root", root]), cli(["index", "--root", root])]);
    activeJobs.push({ directory, jobId: started.jobId });
    expect(duplicate.jobId).toBe(started.jobId);
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runIndexJobCommand({ kind: "index_job", action: "cancel", root, jobId: started.jobId });
    expect(output.mock.calls.map(([value]) => String(value)).join("")).toContain('"cancellationRequested":true');
    output.mockRestore();
    expect((await settled(directory, started.jobId)).status).toBe("cancelled");
    expect(readFileSync(path.join(root, ".understand-code/knowledge-graph.json"), "utf8")).toBe(previous);
    expect(existsSync(path.join(directory, "active.lock"))).toBe(false);
  }, 90_000);

  it("recovers only stopped owned jobs, and respects live recovery locks", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const directory = await resolveIndexJobDirectory(root);
    const token = randomUUID();
    const now = new Date().toISOString();
    writeFileSync(path.join(directory, `${id}.json`), JSON.stringify({ schemaVersion: 1, kind: "index", jobId: id,
      pid: 2_147_483_647, token, status: "running", phase: "scan", createdAt: now, updatedAt: now }), { mode: 0o600 });
    writeFileSync(path.join(directory, "active.lock"), JSON.stringify({ kind: "index", jobId: id, token, pid: 2_147_483_647 }), { mode: 0o600 });
    await reconcileStoppedIndexOperation(directory);
    expect(record(directory, id).status).toBe("interrupted");
    expect(existsSync(path.join(directory, "active.lock"))).toBe(false);
    writeFileSync(path.join(directory, "active.lock"), JSON.stringify({ kind: "recovery", pid: process.pid, nonce: randomUUID() }), { mode: 0o600 });
    await expect(runIndexJobCommand({ kind: "index_job", action: "start", root })).rejects.toMatchObject({ code: "recovery_busy" });
    expect(existsSync(path.join(directory, "active.lock"))).toBe(true);
    writeFileSync(path.join(directory, "active.lock"), JSON.stringify({ kind: "recovery", pid: 2_147_483_647, nonce: randomUUID() }));
    await reconcileStoppedIndexOperation(directory);
    expect(existsSync(path.join(directory, "active.lock"))).toBe(false);
    writeFileSync(path.join(directory, "active.lock"), JSON.stringify({ kind: "unknown", pid: 2_147_483_647 }), { mode: 0o600 });
    await reconcileStoppedIndexOperation(directory);
    expect(existsSync(path.join(directory, "active.lock"))).toBe(true);
  });

  it("refuses a symlinked job directory without writing into its target", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const target = path.join(root, "untrusted");
    await mkdir(target, { mode: 0o700 });
    await symlink(target, path.join(root, ".git/understand-code-index-jobs"));
    await expect(resolveIndexJobDirectory(root)).rejects.toThrow("private and owned");
    expect(existsSync(path.join(target, "active.lock"))).toBe(false);
  });
});
