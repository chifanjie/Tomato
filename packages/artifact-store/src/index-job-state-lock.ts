import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreError } from "./errors.js";
import { withStoreLock } from "./lock.js";
import { ensureManagedDirectory } from "./path-guard.js";

async function assertPrivateJobsDirectory(directory: string): Promise<void> {
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory
    || path.basename(directory) !== "understand-code-index-jobs") {
    throw new ArtifactStoreError("unsafe_path", "Index job state requires its canonical private jobs directory.");
  }
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()
    || await realpath(directory) !== directory
    || (process.geteuid && metadata.uid !== process.geteuid())
    || (metadata.mode & 0o077) !== 0) {
    throw new ArtifactStoreError("unsafe_path", "Index job state requires a private directory owned by the current user.");
  }
}

/** Serialize brief job/recovery state transitions outside the repository artifacts.
 * The caller resolves the worktree's Git jobs directory. This API fixes the lock
 * location and retains the Store's ownership and stale-recovery rules; it never
 * exposes an arbitrary lock path or raw lease to its caller.
 */
export async function withIndexJobStateLock<T>(
  canonicalJobsDirectory: string,
  action: () => Promise<T>,
): Promise<T> {
  await assertPrivateJobsDirectory(canonicalJobsDirectory);
  const locks = await ensureManagedDirectory(canonicalJobsDirectory, ".understand-code/.locks");
  return withStoreLock(canonicalJobsDirectory, path.join(locks, "state.lock"), async () => {
    await assertPrivateJobsDirectory(canonicalJobsDirectory);
    return action();
  });
}
