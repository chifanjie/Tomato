import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { closeSync, constants, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { withIndexJobStateLock } from "@understand-code/artifact-store";
import type { CliInvocation } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { CliOperationErrorV1 } from "./errors/cli-operation-error.js";
import { localRefreshIndexV1 } from "./handlers/local-refresh-index.js";
import { OperationCancelledError, runWithOperationControl } from "./runtime/operation-control.js";

const exec = promisify(execFile);
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const ACTIVE = new Set(["queued", "running"]);
type IndexJob = { schemaVersion: 1; kind: "index"; jobId: string; token: string; pid: number;
  status: "queued" | "running" | "completed" | "cancelled" | "failed" | "interrupted";
  phase: string; createdAt: string; updatedAt: string; snapshotId?: string; errorCode?: string };
type JobLock = { kind: string; jobId?: string; token?: string; pid?: number; nonce?: string };

function privateDirectory(directory: string): void {
  try { mkdirSync(directory, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory
    || (process.getuid && stat.uid !== process.getuid()) || (stat.mode & 0o077) !== 0) throw new Error("Index job directory is not private and owned.");
}

function indexJobEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    const name = key.toUpperCase();
    if (name.startsWith("GIT_") || name.startsWith("DYLD_") ||
      ["NODE_OPTIONS", "NODE_PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "BASH_ENV", "ENV"].includes(name)) delete env[key];
  }
  return { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
}

/** Worktree-specific Git state stays outside the indexed source and legacy artifacts. */
export async function resolveIndexJobDirectory(canonicalRoot: string): Promise<string> {
  const env = indexJobEnvironment();
  const { stdout } = await exec("git", ["rev-parse", "--absolute-git-dir"], { cwd: canonicalRoot, env, timeout: 10_000, maxBuffer: 16_384 });
  const gitPath = stdout.trim();
  if (!path.isAbsolute(gitPath) || /[\r\n\0]/u.test(gitPath)) throw new Error("Git directory is unavailable.");
  const gitDirectory = realpathSync(gitPath);
  if (!lstatSync(gitDirectory).isDirectory()) throw new Error("Git directory is unavailable.");
  const directory = path.join(gitDirectory, "understand-code-index-jobs");
  privateDirectory(directory);
  return directory;
}

function readJson(file: string): unknown {
  let fd: number;
  try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 32_768 || (stat.mode & 0o077) !== 0
      || (process.getuid && stat.uid !== process.getuid())) throw new Error("Unsafe index job state.");
    return JSON.parse(readFileSync(fd, "utf8"));
  } finally { closeSync(fd); }
}

function writeJson(file: string, value: unknown, exclusive = false): void {
  const temporary = exclusive ? file : `${file}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  if (!exclusive) renameSync(temporary, file);
  const parent = openSync(path.dirname(file), constants.O_RDONLY | constants.O_DIRECTORY);
  try { fsyncSync(parent); } finally { closeSync(parent); }
}

function lockAt(directory: string): JobLock | undefined {
  const value = readJson(path.join(directory, "active.lock"));
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || typeof (value as JobLock).kind !== "string") throw new Error("Invalid index operation lock; preserve it and inspect recovery state.");
  return value as JobLock;
}

function readJob(directory: string, id: string): IndexJob {
  if (!ID.test(id)) throw new Error("Invalid index job ID.");
  const job = readJson(path.join(directory, `${id}.json`)) as IndexJob | undefined;
  if (!job || job.schemaVersion !== 1 || job.kind !== "index" || job.jobId !== id || typeof job.token !== "string"
    || !Number.isSafeInteger(job.pid) || job.pid < 1 || ![...ACTIVE, "completed", "cancelled", "failed", "interrupted"].includes(job.status)) throw new Error("Index job is missing or invalid.");
  return job;
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

function release(directory: string, job: IndexJob): void {
  const lock = lockAt(directory);
  if (lock?.kind === "index" && lock.jobId === job.jobId && lock.token === job.token) unlinkSync(path.join(directory, "active.lock"));
}

function reconcile(directory: string, original: IndexJob): IndexJob {
  let job = readJob(directory, original.jobId);
  if (ACTIVE.has(job.status) && !alive(job.pid)) {
    job = { ...job, status: "interrupted", phase: "Worker stopped. Start a new index job; committed artifacts were preserved.", updatedAt: new Date().toISOString() };
    writeJson(path.join(directory, `${job.jobId}.json`), job);
    release(directory, job);
  }
  return job;
}

/** Never steal a live or unknown operation. A stopped worker is retryable. */
function reconcileStoppedOperation(directory: string): void {
  const lock = lockAt(directory);
  if (!lock || !Number.isSafeInteger(lock.pid) || lock.pid! < 1 || alive(lock.pid!)) return;
  if (lock.kind === "index" && lock.jobId && ID.test(lock.jobId) && typeof lock.token === "string") {
    const value = readJson(path.join(directory, `${lock.jobId}.json`));
    if (value !== undefined) {
      const job = readJob(directory, lock.jobId);
      if (job.token !== lock.token || (ACTIVE.has(job.status) && alive(job.pid))) return;
      reconcile(directory, job);
    }
    const current = lockAt(directory);
    if (current?.kind === "index" && current.jobId === lock.jobId && current.token === lock.token && current.pid === lock.pid) unlinkSync(path.join(directory, "active.lock"));
  } else if (lock.kind === "recovery" && typeof lock.nonce === "string" && /^[0-9a-f-]{36}$/u.test(lock.nonce)) {
    const current = lockAt(directory);
    if (current?.kind === "recovery" && current.pid === lock.pid && current.nonce === lock.nonce) unlinkSync(path.join(directory, "active.lock"));
  }
}

export async function reconcileStoppedIndexOperation(directory: string): Promise<void> {
  await withIndexJobStateLock(directory, async () => reconcileStoppedOperation(directory));
}

function publicJob(job: IndexJob) {
  const { token: _token, pid: _pid, ...result } = job;
  return { ...result, nextStep: ACTIVE.has(job.status) ? "Run index --status with the same root to read progress; use --cancel to request cooperative cancellation."
    : job.status === "completed" ? "Create or refresh your Task in the Host, then open Workbench."
    : "Inspect the phase and recovery message, then run index --background to retry. Previous committed artifacts remain available." };
}

function newId(): string {
  let value = (BigInt(Date.now()) << 80n) | BigInt(`0x${randomBytes(10).toString("hex")}`);
  let result = "";
  for (let i = 0; i < 26; i++) { result = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Number(value & 31n)] + result; value >>= 5n; }
  return result;
}

async function start(directory: string, root: string): Promise<IndexJob> {
  return withIndexJobStateLock(directory, async () => {
  reconcileStoppedOperation(directory);
  const existing = lockAt(directory);
  if (existing) {
    if (existing.kind !== "index" || !existing.jobId) throw new CliOperationErrorV1("recovery_busy");
    const job = reconcile(directory, readJob(directory, existing.jobId));
    if (ACTIVE.has(job.status) || alive(job.pid)) return job;
    release(directory, job);
  }
  const now = new Date().toISOString();
  let job: IndexJob = { schemaVersion: 1, kind: "index", jobId: newId(), token: randomUUID(), pid: process.pid, status: "queued", phase: "Waiting for the background worker.", createdAt: now, updatedAt: now };
  writeJson(path.join(directory, "active.lock"), { kind: "index", jobId: job.jobId, token: job.token, pid: job.pid }, true);
  let child: ChildProcess | undefined;
  try {
    writeJson(path.join(directory, `${job.jobId}.json`), job);
    writeJson(path.join(directory, "latest.json"), { jobId: job.jobId });
    // Re-execute the self-contained installed entrypoint, with no dev runner or
    // dependency on the launcher's working directory or standard input.
    // npm exposes an extensionless .bin symlink; re-execute its actual bundle.
    const entrypoint = process.argv[1] ? realpathSync(process.argv[1]) : undefined;
    if (!entrypoint || !/\.[cm]?js$/u.test(entrypoint)) throw new Error("Build or install the CLI before starting a background index job.");
    child = spawn(process.execPath, [entrypoint, "__index-job-run", "--root", root, "--job-id", job.jobId], { cwd: root, detached: true, stdio: "ignore", env: indexJobEnvironment() });
    await new Promise<void>((resolve, reject) => { child!.once("spawn", resolve); child!.once("error", reject); });
    job = { ...job, pid: child.pid! };
    writeJson(path.join(directory, `${job.jobId}.json`), job);
    writeJson(path.join(directory, "active.lock"), { kind: "index", jobId: job.jobId, token: job.token, pid: job.pid });
    child.unref();
    return job;
  } catch (error) {
    // A spawned worker is waiting for this short lock until both PID records
    // are durable. Join it before abandoning ownership after a failed handoff.
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill("SIGTERM");
      const kill = setTimeout(() => child?.kill("SIGKILL"), 2_000);
      try { await closed; } finally { clearTimeout(kill); }
    }
    job = { ...job, status: "failed", phase: "Could not launch the background index worker.", errorCode: "worker_launch_failed", updatedAt: new Date().toISOString() };
    writeJson(path.join(directory, `${job.jobId}.json`), job); release(directory, job); throw error;
  }
  });
}

async function run(directory: string, root: string, id: string): Promise<void> {
  let job = await withIndexJobStateLock(directory, async () => {
    const current = readJob(directory, id);
    const lock = lockAt(directory);
    if (current.pid !== process.pid || current.status !== "queued" || lock?.kind !== "index" || lock.pid !== process.pid || lock.jobId !== id || lock.token !== current.token) throw new Error("Background worker ownership mismatch.");
    return current;
  });
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGTERM", abort); process.once("SIGINT", abort);
  const save = async (update: Partial<IndexJob>) => withIndexJobStateLock(directory, async () => {
    job = { ...job, ...update, updatedAt: new Date().toISOString() };
    writeJson(path.join(directory, `${id}.json`), job);
  });
  try {
    await save({ status: "running", phase: "Starting repository indexing." });
    const result = await runWithOperationControl({ signal: controller.signal, onProgress: async (phase) => {
      const cancel = readJson(path.join(directory, `${id}.cancel`)) as { token?: string } | undefined;
      if (cancel?.token === job.token) controller.abort();
      await save({ phase });
    } }, () => localRefreshIndexV1({ mode: "full", actor: "codex", idempotencyKey: `index-job:${id}` }, root)) as { structuredContent?: { result?: { operation?: { finalSnapshotId?: string } } } };
    await save({ status: "completed", phase: "Repository index committed; ready to create or refresh a Task.", snapshotId: result.structuredContent?.result?.operation?.finalSnapshotId });
  } catch (error) {
    const cancelled = error instanceof OperationCancelledError;
    await save({ status: cancelled ? "cancelled" : "failed", phase: cancelled ? "Cancelled before the next commit. Previous committed artifacts were preserved."
      : error instanceof CliOperationErrorV1 ? error.message
        : `Failed during: ${job.phase} Check source exclusions and repository state; run understand-code --help for recovery options.`,
      errorCode: cancelled ? "cancelled" : error instanceof CliOperationErrorV1 ? error.code : "index_failed" });
  } finally {
    process.off("SIGTERM", abort); process.off("SIGINT", abort);
    await withIndexJobStateLock(directory, async () => release(directory, job));
  }
}

/** Shared CLI/MCP entrypoints never write to the protocol transport. */
export async function startIndexJobV1(canonicalRoot: string) {
  return publicJob(await start(await resolveIndexJobDirectory(canonicalRoot), canonicalRoot));
}

export async function controlIndexJobV1(canonicalRoot: string, action: "status" | "cancel", jobId?: string) {
  if (jobId !== undefined && !ID.test(jobId)) throw new Error("Invalid index job ID.");
  const directory = await resolveIndexJobDirectory(canonicalRoot);
  return withIndexJobStateLock(directory, async () => {
    const pointer = readJson(path.join(directory, "latest.json")) as { jobId?: string } | undefined;
    const id = jobId ?? pointer?.jobId;
    if (!id) return undefined;
    if (!ID.test(id)) throw new Error("Invalid index job ID.");
    if (readJson(path.join(directory, `${id}.json`)) === undefined) return undefined;
    const job = reconcile(directory, readJob(directory, id));
    if (action === "cancel" && ACTIVE.has(job.status)) {
      writeJson(path.join(directory, `${id}.cancel`), { token: job.token });
      return { ...publicJob(job), cancellationRequested: true };
    }
    return publicJob(job);
  });
}

export async function runIndexJobCommand(invocation: Extract<CliInvocation, { kind: "index_job" }>): Promise<void> {
  const binding = await resolveInitialBinding([invocation.root]);
  if (binding.kind !== "bound") throw new Error("Use the absolute Git worktree root for index operations.");
  if (invocation.action === "run") {
    await run(await resolveIndexJobDirectory(binding.canonicalRoot), binding.canonicalRoot, invocation.jobId!); return;
  }
  const result = invocation.action === "start" ? await startIndexJobV1(binding.canonicalRoot)
    : await controlIndexJobV1(binding.canonicalRoot, invocation.action, invocation.jobId);
  process.stdout.write(`${JSON.stringify(result ?? { status: "missing", nextStep: "Run index --background with the same root." })}\n`);
}
