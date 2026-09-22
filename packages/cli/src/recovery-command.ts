import { constants } from "node:fs";
import { cp, lstat, mkdir, open, readFile, readdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { hostname } from "node:os";
import { withIndexJobStateLock } from "@understand-code/artifact-store";
import { BuildTaskBriefOutputV1Schema } from "@understand-code/contracts";
import type { CliInvocation } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { CliOperationErrorV1 } from "./errors/cli-operation-error.js";
import { assertNoRepositoryAccess, runWithinRecovery } from "./runtime/recovery-guard.js";
import { writeErrorDiagnostic } from "./logging/stderr.js";
import { callImplementedTool } from "./handlers/tools.js";
import { reconcileStoppedIndexOperation, resolveIndexJobDirectory } from "./index-job-command.js";

interface RecoveryManifest {
  schemaVersion: 1;
  backupId: string;
  kind: "repository" | "writer-draft";
  canonicalRoot: string;
  createdAt: string;
  taskId?: string;
}
const backupIdPattern = /^recovery-[0-9a-f]{32}$/u;
const taskIdPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const quote = (value: string) => `'${value.replace(/'/gu, `'\\''`)}'`;
const recoveryId = () => `recovery-${randomUUID().replace(/-/gu, "")}`;

async function directory(directoryPath: string, create = false): Promise<void> {
  if (create) await mkdir(directoryPath, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
  const stat = await lstat(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(directoryPath) !== directoryPath
    || (process.geteuid && stat.uid !== process.geteuid())) throw new CliOperationErrorV1("recovery_unsafe_path");
}

async function syncDirectory(directoryPath: string): Promise<void> {
  const handle = await open(directoryPath, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function lockBlocksRecovery(lockPath: string): Promise<boolean> {
  try {
    const stat = await lstat(lockPath);
    if (stat.isSymbolicLink()) return true;
    const ownerPath = stat.isDirectory() ? path.join(lockPath, "owner.json") : lockPath;
    const handle = await open(ownerPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let text: string;
    try {
      const ownerStat = await handle.stat();
      if (!ownerStat.isFile() || ownerStat.nlink !== 1 || ownerStat.size > 4096
        || (process.geteuid && ownerStat.uid !== process.geteuid())) return true;
      text = await handle.readFile("utf8");
    } finally { await handle.close(); }
    let pid: number;
    if (stat.isDirectory()) {
      const owner = JSON.parse(text);
      if (owner.version !== 1 || owner.hostname !== hostname() || typeof owner.nonce !== "string") return true;
      pid = owner.pid;
    } else {
      const match = /^([1-9][0-9]{0,9}):[0-9a-f]{32}\n$/u.exec(text);
      if (!match) return true;
      pid = Number(match[1]);
    }
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) return true;
    try { process.kill(pid, 0); return true; }
    catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
  } catch { return true; }
}

async function hasLocks(directoryPath: string): Promise<boolean> {
  const stat = await lstat(directoryPath).catch((error: unknown) => { if (missing(error)) return undefined; throw error; });
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) return true;
  const names = await readdir(directoryPath).catch((error: unknown) => { if (missing(error)) return []; throw error; });
  for (const name of names) {
    const entryPath = path.join(directoryPath, name);
    const stat = await lstat(entryPath);
    if (name.endsWith(".lock")) { if (await lockBlocksRecovery(entryPath)) return true; continue; }
    if (stat.isSymbolicLink() || !stat.isDirectory() || await hasLocks(entryPath)) return true;
  }
  return false;
}

async function assertOffline(canonicalRoot: string): Promise<void> {
  const managed = path.join(canonicalRoot, ".understand-code");
  const names = await readdir(managed).catch((error: unknown) => { if (missing(error)) return []; throw error; });
  for (const name of names.filter((entry) => entry.endsWith(".lock"))) {
    if (await lockBlocksRecovery(path.join(managed, name))) throw new CliOperationErrorV1("recovery_busy");
  }
  if (await hasLocks(path.join(managed, ".locks"))) throw new CliOperationErrorV1("recovery_busy");
}

/** A recovery never changes source or follows a repository-controlled backup path. */
export async function withRecoverySession<T>(canonicalRoot: string, operation: (backupRoot: string) => Promise<T>): Promise<T> {
  const jobs = await resolveIndexJobDirectory(canonicalRoot);
  await reconcileStoppedIndexOperation(jobs);
  const lockPath = path.join(jobs, "active.lock");
  const token = JSON.stringify({ kind: "recovery", pid: process.pid, nonce: randomUUID() });
  const lock = await withIndexJobStateLock(jobs, async () => {
    let handle;
    try { handle = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new CliOperationErrorV1("recovery_busy"); throw error; }
    try { await handle.writeFile(token); await handle.sync(); return handle; }
    catch (error) { await handle.close(); await unlink(lockPath); throw error; }
  });
  try {
    await assertNoRepositoryAccess(jobs);
    const managed = path.join(canonicalRoot, ".understand-code");
    await directory(managed).catch((error: unknown) => { if (!missing(error)) throw error; });
    await assertOffline(canonicalRoot);
    const backups = path.join(path.dirname(jobs), "understand-code-recovery");
    await directory(backups, true);
    return await runWithinRecovery(canonicalRoot, () => operation(backups));
  } finally {
    await lock.close();
    await withIndexJobStateLock(jobs, async () => {
      if (await readFile(lockPath, "utf8").catch(() => undefined) === token) await unlink(lockPath);
    });
  }
}

async function newBackup(canonicalRoot: string, backupRoot: string, kind: RecoveryManifest["kind"], taskId?: string) {
  const backupId = recoveryId();
  const backupPath = path.join(backupRoot, backupId);
  await directory(backupPath, true);
  const manifest: RecoveryManifest = { schemaVersion: 1, backupId, kind, canonicalRoot, createdAt: new Date().toISOString(), ...(taskId ? { taskId } : {}) };
  await writeFile(path.join(backupPath, "recovery.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600, flush: true });
  await writeFile(path.join(backupPath, "README.txt"), [
    "Original material is retained in state/ without rewriting its content.",
    "Stop all Understand Code Hosts, index jobs and Workbench readers before recovery or restore.",
    `Restore: understand-code recover --root ${quote(canonicalRoot)} --restore ${backupId}`,
    "Restore keeps this backup and archives any current state before replacing it.",
    "A restored old writer draft still requires its original source snapshot; it cannot publish against newer source.",
    "This directory is in the worktree Git administration directory. Copy it elsewhere before removing the worktree or its Git metadata.",
    "If rebuilding failed, use the restore command above or run recover --rebuild again; the original backup remains intact.",
  ].join("\n") + "\n", { flag: "wx", mode: 0o600, flush: true });
  await syncDirectory(backupPath);
  return { backupId, backupPath, manifest };
}

function statePath(canonicalRoot: string, manifest: Pick<RecoveryManifest, "kind" | "taskId">): string {
  return manifest.kind === "repository" ? path.join(canonicalRoot, ".understand-code")
    : path.join(canonicalRoot, ".understand-code/knowledge-drafts", manifest.taskId!);
}

async function assertStatePath(canonicalRoot: string, manifest: Pick<RecoveryManifest, "kind" | "taskId">): Promise<void> {
  await directory(path.join(canonicalRoot, ".understand-code"));
  if (manifest.kind === "writer-draft") {
    await directory(path.join(canonicalRoot, ".understand-code/knowledge-drafts"));
    await directory(statePath(canonicalRoot, manifest));
  }
}

export async function archiveWriterDraft(canonicalRoot: string, taskId: string, backupRoot: string): Promise<string | undefined> {
  if (!taskIdPattern.test(taskId)) throw new CliOperationErrorV1("recovery_unsafe_path");
  const state = { kind: "writer-draft" as const, taskId };
  try { await assertStatePath(canonicalRoot, state); } catch (error) { if (missing(error)) return undefined; throw error; }
  const backup = await newBackup(canonicalRoot, backupRoot, state.kind, taskId);
  await rename(statePath(canonicalRoot, state), path.join(backup.backupPath, "state"));
  await syncDirectory(backup.backupPath);
  await syncDirectory(path.dirname(statePath(canonicalRoot, state)));
  process.stdout.write(`${JSON.stringify({ status: "draft_archived", backupId: backup.backupId, backupPath: backup.backupPath, taskId,
    restore: `understand-code recover --root ${quote(canonicalRoot)} --restore ${backup.backupId}` })}\n`);
  return backup.backupId;
}

async function restore(canonicalRoot: string, backupRoot: string, backupId: string): Promise<void> {
  if (!backupIdPattern.test(backupId)) throw new CliOperationErrorV1("recovery_unsafe_path");
  const source = path.join(backupRoot, backupId);
  await directory(source);
  await directory(path.join(source, "state"));
  const manifestFile = await open(path.join(source, "recovery.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
  let manifest: RecoveryManifest;
  try { manifest = JSON.parse(await manifestFile.readFile("utf8")) as RecoveryManifest; } finally { await manifestFile.close(); }
  if (manifest.schemaVersion !== 1 || manifest.backupId !== backupId || manifest.canonicalRoot !== canonicalRoot
    || !["repository", "writer-draft"].includes(manifest.kind)
    || (manifest.kind === "writer-draft" && !taskIdPattern.test(manifest.taskId ?? ""))) throw new CliOperationErrorV1("recovery_unsafe_path");
  const target = statePath(canonicalRoot, manifest);
  const current = await newBackup(canonicalRoot, backupRoot, manifest.kind, manifest.taskId);
  const staged = path.join(current.backupPath, "restore-staging");
  // Copy before moving the current state, so a full disk cannot remove the working copy.
  // Preserve symlinks as symlinks; never follow their targets.
  await cp(path.join(source, "state"), staged, { recursive: true, dereference: false, verbatimSymlinks: true, errorOnExist: true, force: false });
  let hadCurrent = false;
  try {
    await assertStatePath(canonicalRoot, manifest);
    await rename(target, path.join(current.backupPath, "state"));
    hadCurrent = true;
  } catch (error) { if (!missing(error)) throw error; }
  if (manifest.kind === "writer-draft") {
    await directory(path.join(canonicalRoot, ".understand-code"), true);
    await directory(path.dirname(target), true);
  }
  try { await rename(staged, target); }
  catch (error) { if (hadCurrent) await rename(path.join(current.backupPath, "state"), target); throw error; }
  await syncDirectory(path.dirname(target));
  await syncDirectory(current.backupPath);
  process.stdout.write(`${JSON.stringify({ status: "restored", backupId, previousBackupId: hadCurrent ? current.backupId : null,
    message: "Original backup retained. The prior current state was also archived. Restart the appropriate Host or reader after restoration." })}\n`);
}

export async function runRecoveryCommand(invocation: Extract<CliInvocation, { kind: "recovery" }>): Promise<void> {
  const binding = await resolveInitialBinding([invocation.root]);
  if (binding.kind !== "bound") throw new CliOperationErrorV1("knowledge_root_unavailable");
  const canonicalRoot = binding.canonicalRoot;
  await withRecoverySession(canonicalRoot, async (backupRoot) => {
    if (invocation.action === "restore") return restore(canonicalRoot, backupRoot, invocation.backupId!);
    const state = path.join(canonicalRoot, ".understand-code");
    await directory(state).catch((error: unknown) => { if (missing(error)) throw new CliOperationErrorV1("recovery_no_state"); throw error; });
    const backup = await newBackup(canonicalRoot, backupRoot, "repository");
    await rename(state, path.join(backup.backupPath, "state"));
    await syncDirectory(backup.backupPath); await syncDirectory(canonicalRoot);
    process.stdout.write(`${JSON.stringify({ status: "archived", backupId: backup.backupId, backupPath: backup.backupPath,
      restore: `understand-code recover --root ${quote(canonicalRoot)} --restore ${backup.backupId}` })}\n`);
    try {
      const result = BuildTaskBriefOutputV1Schema.parse(await callImplementedTool("build_task_brief", {
        task: "Rebuild repository understanding from current source. Use archived knowledge only as a historical reference and verify new conclusions against current evidence.",
        expectedRevision: 0, actor: "codex", idempotencyKey: backup.backupId,
      }, canonicalRoot, { runtimeProfile: "local_durable_v1" }));
      const taskId = result.structuredContent.result.task.taskId;
      process.stdout.write(`${JSON.stringify({ status: "rebuilt", taskId, backupId: backup.backupId,
        workbench: `understand-code workbench --root ${quote(canonicalRoot)} --task-id ${taskId}`,
        message: "Current source was indexed into a new local Task. Archived conclusions and verification were not imported." })}\n`);
    } catch (error) { writeErrorDiagnostic(randomUUID(), error, "refresh_index"); throw new CliOperationErrorV1("recovery_rebuild_failed"); }
  });
}
