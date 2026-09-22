import { chmod, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withIndexJobStateLock } from "../src/index.js";
import { cleanupTemporaryWorktrees, createTemporaryWorktree } from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

async function jobsDirectory() {
  const root = await realpath(await createTemporaryWorktree());
  const jobs = path.join(root, "understand-code-index-jobs");
  await mkdir(jobs, { mode: 0o700 });
  return { root, jobs };
}

describe("private index job state lock", () => {
  it("serializes transitions and preserves unrelated job data", async () => {
    const { jobs } = await jobsDirectory();
    const active = path.join(jobs, "active.lock");
    await writeFile(active, "caller-owned job metadata", { mode: 0o600 });
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const sequence: string[] = [];
    const first = withIndexJobStateLock(jobs, async () => {
      sequence.push("first"); entered(); await gate; sequence.push("first done"); return 1;
    });
    await started;
    const second = withIndexJobStateLock(jobs, async () => { sequence.push("second"); return 2; });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sequence).toEqual(["first"]);
    release();
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(sequence).toEqual(["first", "first done", "second"]);
    expect(await readFile(active, "utf8")).toBe("caller-owned job metadata");
  });

  it("releases its fixed lock when the action fails", async () => {
    const { jobs } = await jobsDirectory();
    await expect(withIndexJobStateLock(jobs, async () => { throw new Error("action failed"); })).rejects.toThrow("action failed");
    await expect(withIndexJobStateLock(jobs, async () => "retry")).resolves.toBe("retry");
  });

  it("rejects relative, noncanonical, wrongly named and public directories before running an action", async () => {
    const { root, jobs } = await jobsDirectory();
    const action = vi.fn(async () => undefined);
    for (const candidate of ["understand-code-index-jobs", root, `${jobs}/../understand-code-index-jobs`]) {
      await expect(withIndexJobStateLock(candidate, action)).rejects.toMatchObject({ code: "unsafe_path" });
    }
    await chmod(jobs, 0o755);
    await expect(withIndexJobStateLock(jobs, action)).rejects.toMatchObject({ code: "unsafe_path" });
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects symlinked jobs and managed lock directories", async () => {
    const { root, jobs } = await jobsDirectory();
    const aliasParent = path.join(root, "alias");
    await mkdir(aliasParent, { mode: 0o700 });
    const alias = path.join(aliasParent, "understand-code-index-jobs");
    await symlink(jobs, alias);
    const action = vi.fn(async () => undefined);
    await expect(withIndexJobStateLock(alias, action)).rejects.toMatchObject({ code: "unsafe_path" });
    const outside = path.join(root, "outside");
    await mkdir(outside, { mode: 0o700 });
    await writeFile(path.join(outside, "keep"), "retained");
    await symlink(outside, path.join(jobs, ".understand-code"));
    await expect(withIndexJobStateLock(jobs, action)).rejects.toMatchObject({ code: "symlink_rejected" });
    expect(action).not.toHaveBeenCalled();
    expect(await readFile(path.join(outside, "keep"), "utf8")).toBe("retained");
  });
});
