import { readFile, readdir, mkdir, symlink, writeFile, lstat, readlink } from "node:fs/promises";
import { AsyncResource } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { hostname } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import { parseCliArguments } from "../src/argv.js";
import { assertCompatibleLocalArtifacts } from "../src/runtime/legacy-recovery.js";
import { withRepositoryAccess } from "../src/runtime/recovery-guard.js";
import { withRecoverySession, runRecoveryCommand } from "../src/recovery-command.js";
import { runKnowledgeCommand } from "../src/knowledge-command.js";
import { resolveIndexJobDirectory } from "../src/index-job-command.js";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository, createTemporaryDirectory, seedLegacyTask } from "./helpers.js";

const local = { runtimeProfile: "local_durable_v1" as const };
afterEach(async () => { vi.restoreAllMocks(); await closeAllWorkbenchSessionsV1(); await cleanupTemporaryDirectories(); });
function captureOutput() {
  const messages: any[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
    try { messages.push(JSON.parse(String(chunk))); } catch { /* Writer progress is not JSON. */ }
    return true;
  });
  return messages;
}
async function files(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function scan(directory: string, relative = "") {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const key = path.posix.join(relative, name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) result[key] = `link:${await readlink(absolute)}`;
      else if (stat.isDirectory()) await scan(absolute, key);
      else result[key] = createHash("sha256").update(await readFile(absolute)).digest("hex");
    }
  }
  await scan(root); return result;
}

describe("explicit old-state recovery", () => {
  it("accepts a valid initialized ArtifactStore without an active index and refuses loose legacy data", async () => {
    const initialized = await createGitRepository();
    await expect(assertCompatibleLocalArtifacts(initialized)).resolves.toBeUndefined();
    const loose = await createGitRepository({ seedArtifacts: false });
    await mkdir(path.join(loose, ".understand-code"));
    await writeFile(path.join(loose, ".understand-code/knowledge-graph.json"), "old graph bytes");
    await expect(assertCompatibleLocalArtifacts(loose)).rejects.toMatchObject({ code: "legacy_state_requires_recovery" });
    expect(await readFile(path.join(loose, ".understand-code/knowledge-graph.json"), "utf8")).toBe("old graph bytes");
  });

  it("requires an explicit recovery action and rejects ambiguous index/writer commands", () => {
    expect(parseCliArguments(["recover", "--root", "/tmp/repo", "--rebuild"])).toEqual({ kind: "recovery", root: "/tmp/repo", action: "rebuild" });
    expect(() => parseCliArguments(["recover", "--root", "/tmp/repo"])).toThrow();
    expect(() => parseCliArguments(["recover", "--root", "/tmp/repo", "--restore", "../outside"])).toThrow();
    expect(() => parseCliArguments(["recover", "--root", "/tmp/repo", "--rebuild", "--restore", `recovery-${"a".repeat(32)}`])).toThrow();
    expect(() => parseCliArguments(["index", "--root", "/tmp/repo", "__proto__"])).toThrow();
    expect(() => parseCliArguments(["index", "--root", "/tmp/repo", "--background", "--cancel"])).toThrow();
    expect(() => parseCliArguments(["__index-job-run", "--root", "/tmp/repo"])).toThrow();
    expect(parseCliArguments(["knowledge", "--root", "/tmp/repo", "--task-id", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--restart-draft"]).kind).toBe("knowledge");
  });

  it("archives exact legacy material, builds a readable new Task, and restores without losing either version", async () => {
    const root = await createGitRepository();
    const legacy = await seedLegacyTask(root, { task: "Historical task from the old runtime", expectedRevision: 0, actor: "codex", idempotencyKey: "legacy-recovery" });
    await writeFile(path.join(root, ".understand-code/knowledge-base/legacy.md"), "# 原始知识\n保留旧结论与手工批注，不转成新的验证。\n");
    // Recovery must work even when legacy metadata can no longer be parsed.
    await writeFile(path.join(root, ".understand-code/artifact-manifest.json"), "{ old unsupported manifest\n");
    const deadPid = Number(execFileSync(process.execPath, ["-p", "process.pid"], { encoding: "utf8" }).trim());
    await mkdir(path.join(root, ".understand-code/.local-refresh.lock"));
    await writeFile(path.join(root, ".understand-code/.local-refresh.lock/owner.json"), JSON.stringify({ version: 1, hostname: hostname(), pid: deadPid, nonce: "stopped-owner" }));
    const before = await files(path.join(root, ".understand-code"));
    const messages = captureOutput();
    const refused: any = await callImplementedTool("build_task_brief", { task: "Do not silently rewrite old artifacts", expectedRevision: 0, actor: "codex", idempotencyKey: "legacy-must-preserve" }, root, local);
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain("recover --root");
    expect(await files(path.join(root, ".understand-code"))).toEqual(before);
    await runRecoveryCommand({ kind: "recovery", action: "rebuild", root });
    const archived = messages.find((message) => message.status === "archived");
    const rebuilt = messages.find((message) => message.status === "rebuilt");
    expect(rebuilt.taskId).not.toBe(legacy.task.taskId);
    expect(await files(path.join(archived.backupPath, "state"))).toEqual(before);
    expect(await readFile(path.join(archived.backupPath, "README.txt"), "utf8")).toContain(`--restore ${archived.backupId}`);

    const opened: any = await callImplementedTool("open_workbench", { route: { view: "tasks", taskId: rebuilt.taskId, section: "summary" } }, root, local);
    const url = new URL(opened.structuredContent.result.deepLink);
    expect([401, 403]).toContain((await fetch(new URL(`/tasks/${rebuilt.taskId}/brief.json?section=summary`, url))).status);
    const launch = await fetch(new URL("/__workbench/launch", url), { method: "POST", headers: { "content-type": "application/json", origin: url.origin }, body: JSON.stringify({ token: url.hash.slice(1) }) });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const brief = await fetch(new URL(`/tasks/${rebuilt.taskId}/brief.json?section=summary`, url), { headers: { cookie } });
    expect(brief.status).toBe(200);
    expect(await brief.text()).toContain(rebuilt.taskId);
    await closeAllWorkbenchSessionsV1();
    const current = await files(path.join(root, ".understand-code"));
    await runRecoveryCommand({ kind: "recovery", action: "restore", root, backupId: archived.backupId });
    expect(await files(path.join(root, ".understand-code"))).toEqual(before);
    expect(await files(path.join(archived.backupPath, "state"))).toEqual(before);
    const restored = messages.find((message) => message.status === "restored");
    expect(await files(path.join(path.dirname(archived.backupPath), restored.previousBackupId, "state"))).toEqual(current);
  }, 90_000);

  it("restarts a stale writer after real Task context refresh and preserves a reversible source-bound draft", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const created: any = await callImplementedTool("build_task_brief", { task: "Explain current numeric behavior", expectedRevision: 0, actor: "codex", idempotencyKey: "restart-draft-task" }, root, local);
    const task = created.structuredContent.result.task;
    const messages = captureOutput();
    const run = (...writerArgs: string[]) => runKnowledgeCommand({ kind: "knowledge", root, taskId: task.taskId, writerArgs });
    await run("--prepare-file-docs");
    const draft = path.join(root, ".understand-code/knowledge-drafts", task.taskId);
    await writeFile(path.join(draft, ".intermediate/manual-notes.md"), "手工写作未完成；原样保留。\n");
    const before = await files(draft);
    const originalBinding = await readFile(path.join(draft, ".intermediate/source-binding.json"), "utf8");
    await writeFile(path.join(root, "src/task.ts"), "export function task(): boolean { return false; }\n");
    await expect(run("--restart-draft")).rejects.toMatchObject({ code: "writer_snapshot_stale" });
    await expect(run("--retry")).resolves.toBeUndefined();
    expect(await files(draft)).toEqual(before);
    const refreshed: any = await callImplementedTool("refresh_index", { mode: "full", actor: "codex", idempotencyKey: "restart-draft-index" }, root, local);
    const targetSnapshotId = refreshed.structuredContent.result.operation.finalSnapshotId;
    const updated: any = await callImplementedTool("update_task", { taskId: task.taskId, expectedRevision: task.revision, actor: "codex", idempotencyKey: "restart-draft-context",
      action: { type: "refresh_task_context", targetSnapshotId } }, root, local);
    expect(updated.isError, JSON.stringify(updated)).toBe(false);
    await run("--restart-draft");
    const archived = messages.find((message) => message.status === "draft_archived");
    expect(await files(path.join(archived.backupPath, "state"))).toEqual(before);
    expect(await readFile(path.join(draft, ".intermediate/source-binding.json"), "utf8")).not.toBe(originalBinding);
    const fresh = await files(draft);
    await runRecoveryCommand({ kind: "recovery", action: "restore", root, backupId: archived.backupId });
    expect(await files(draft)).toEqual(before);
    const restored = messages.find((message) => message.status === "restored");
    expect(await files(path.join(path.dirname(archived.backupPath), restored.previousBackupId, "state"))).toEqual(fresh);
    await expect(run("--merge-file-docs")).rejects.toMatchObject({ code: "writer_phase_failed" });
    await run("--restart-draft");
    expect(await readFile(path.join(draft, ".intermediate/source-binding.json"), "utf8")).not.toBe(originalBinding);
  }, 90_000);

  it("blocks recovery while a request is in flight and blocks new local requests during recovery", async () => {
    const root = await createGitRepository();
    const before = await files(path.join(root, ".understand-code"));
    await withRepositoryAccess(root, async () => {
      await expect(runRecoveryCommand({ kind: "recovery", action: "rebuild", root })).rejects.toMatchObject({ code: "recovery_busy" });
    });
    const independentRequest = AsyncResource.bind(() => callImplementedTool("build_task_brief", {
      task: "Must not create a Task while recovery owns the root", expectedRevision: 0, actor: "codex", idempotencyKey: "recovery-race",
    }, root, local));
    await withRecoverySession(root, async () => {
      const result: any = await independentRequest();
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("repository_recovery_in_progress");
    });
    expect(await files(path.join(root, ".understand-code"))).toEqual(before);
  });

  it("refuses a live indexing lock and symlinked state before archiving", async () => {
    const root = await createGitRepository();
    const before = await files(path.join(root, ".understand-code"));
    const jobs = await resolveIndexJobDirectory(root);
    await writeFile(path.join(jobs, "active.lock"), JSON.stringify({ kind: "recovery", pid: process.pid, nonce: "active-owner" }), { mode: 0o600 });
    await expect(runRecoveryCommand({ kind: "recovery", action: "rebuild", root })).rejects.toMatchObject({ code: "recovery_busy" });
    expect(await files(path.join(root, ".understand-code"))).toEqual(before);
    const clean = await createGitRepository({ seedArtifacts: false });
    const outside = await createTemporaryDirectory("recovery-outside-");
    await writeFile(path.join(outside, "keep.txt"), "not a managed directory");
    await symlink(outside, path.join(clean, ".understand-code"));
    await expect(runRecoveryCommand({ kind: "recovery", action: "rebuild", root: clean })).rejects.toMatchObject({ code: "recovery_unsafe_path" });
    expect(await readFile(path.join(outside, "keep.txt"), "utf8")).toBe("not a managed directory");
  });
});
