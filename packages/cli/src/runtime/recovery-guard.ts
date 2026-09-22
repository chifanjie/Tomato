import { AsyncLocalStorage } from "node:async_hooks";
import { constants } from "node:fs";
import { open, readFile, readdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { CliOperationErrorV1 } from "../errors/cli-operation-error.js";
import { resolveIndexJobDirectory } from "../index-job-command.js";

const access = new AsyncLocalStorage<ReadonlySet<string>>();
export function hasRepositoryAccess(root: string): boolean { return access.getStore()?.has(root) === true; }
export function runWithinRecovery<T>(root: string, operation: () => Promise<T>): Promise<T> {
  return access.run(new Set([...(access.getStore() ?? []), root]), operation);
}

async function readOwned(file: string): Promise<string> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096 || (stat.mode & 0o077) !== 0
      || (process.geteuid && stat.uid !== process.geteuid())) throw new CliOperationErrorV1("recovery_busy");
    return await handle.readFile("utf8");
  } finally { await handle.close(); }
}

/** Publish an in-flight marker before checking recovery, so neither side can miss the other. */
export async function withRepositoryAccess<T>(root: string, operation: () => Promise<T>): Promise<T> {
  if (hasRepositoryAccess(root)) return operation();
  const directory = await resolveIndexJobDirectory(root);
  const marker = path.join(directory, `access-${randomUUID().replace(/-/gu, "")}.json`);
  const token = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  const handle = await open(marker, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(token); await handle.sync();
    const active = await readOwned(path.join(directory, "active.lock")).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; });
    if (active !== undefined) {
      let kind: unknown;
      try { kind = JSON.parse(active).kind; } catch { throw new CliOperationErrorV1("recovery_busy"); }
      if (kind !== "index") throw new CliOperationErrorV1("recovery_busy");
    }
    return await runWithinRecovery(root, operation);
  } finally {
    await handle.close();
    if (await readFile(marker, "utf8").catch(() => undefined) === token) await unlink(marker);
  }
}

/** Called only after recovery owns active.lock, which bars subsequent requests. */
export async function assertNoRepositoryAccess(directory: string): Promise<void> {
  for (const name of await readdir(directory)) {
    if (!/^access-[0-9a-f]{32}\.json$/u.test(name)) continue;
    const file = path.join(directory, name);
    let bytes: string;
    try { bytes = await readOwned(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    let owner: { pid: number; nonce: string };
    try { owner = JSON.parse(bytes); } catch { throw new CliOperationErrorV1("recovery_busy"); }
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.nonce !== "string") throw new CliOperationErrorV1("recovery_busy");
    try { process.kill(owner.pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        if (await readOwned(file).catch(() => undefined) === bytes) await unlink(file);
        continue;
      }
    }
    throw new CliOperationErrorV1("recovery_busy");
  }
}
