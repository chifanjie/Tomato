import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";

import { canonicalizeJson } from "@understand-code/contracts";

import { atomicWriteJson, readManagedJson } from "./atomic.js";
import { ArtifactStoreError } from "./errors.js";
import {
  assertManagedParentStable,
  repositoryRelativePathFromAbsolute,
  resolveManagedPath,
} from "./path-guard.js";

interface LockOwnerRecord {
  version: 1;
  nonce: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface LockAcquireOptions {
  timeoutMs?: number;
  staleAfterMs?: number;
  pollMinMs?: number;
  pollMaxMs?: number;
  now?: () => number;
}

export interface StoreLockLease {
  readonly lockPath: string;
  readonly nonce: string;
  refresh(): Promise<void>;
  release(): Promise<void>;
}

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

function isOwnerRecord(value: unknown): value is LockOwnerRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LockOwnerRecord>;
  return (
    candidate.version === 1 &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length > 0 &&
    typeof candidate.pid === "number" &&
    Number.isSafeInteger(candidate.pid) &&
    candidate.pid > 0 &&
    typeof candidate.hostname === "string" &&
    typeof candidate.acquiredAt === "string" &&
    Number.isFinite(Date.parse(candidate.acquiredAt)) &&
    typeof candidate.heartbeatAt === "string" &&
    Number.isFinite(Date.parse(candidate.heartbeatAt))
  );
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function readOwner(
  canonicalWorktreeRoot: string,
  lockPath: string,
): Promise<LockOwnerRecord | undefined> {
  const ownerPath = path.join(lockPath, "owner.json");
  try {
    const value = await readManagedJson(canonicalWorktreeRoot, ownerPath);
    return isOwnerRecord(value) ? value : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    if (
      error instanceof ArtifactStoreError &&
      (error.code === "artifact_not_found" ||
        error.code === "artifact_corrupt")
    ) {
      return undefined;
    }
    throw error;
  }
}

async function removeLockTombstone(tombstonePath: string): Promise<void> {
  const entries = await readdir(tombstonePath);
  for (const entry of entries) {
    if (
      entry !== "owner.json" &&
      !entry.startsWith(".owner.json.tmp-")
    ) {
      throw new ArtifactStoreError(
        "lock_ownership_lost",
        "Refusing to remove a lock tombstone containing unknown files.",
        { tombstonePath, entry },
      );
    }
    await unlink(path.join(tombstonePath, entry));
  }
  await rmdir(tombstonePath);
}

async function initializeOwnerFile(
  canonicalWorktreeRoot: string,
  lockPath: string,
  owner: LockOwnerRecord,
): Promise<void> {
  const ownerPath = path.join(lockPath, "owner.json");
  await assertManagedParentStable(canonicalWorktreeRoot, ownerPath);
  const noFollow =
    typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(
    ownerPath,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      noFollow,
    0o600,
  );
  try {
    await handle.writeFile(`${canonicalizeJson(owner)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function abandonCreatedLock(
  canonicalWorktreeRoot: string,
  lockPath: string,
  observedInode: number,
): Promise<void> {
  let current;
  try {
    current = await lstat(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (current.ino !== observedInode) return;

  const tombstonePath = `${lockPath}.abandoned-${randomUUID()}`;
  try {
    await rename(lockPath, tombstonePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await removeLockTombstone(tombstonePath);
  await assertManagedParentStable(canonicalWorktreeRoot, lockPath);
}

async function recoverStaleLock(
  canonicalWorktreeRoot: string,
  lockPath: string,
  observedOwner: LockOwnerRecord,
  observedInode: number,
): Promise<boolean> {
  const recoveryClaimPath = `${lockPath}.stale-recovery.json`;
  await resolveManagedPath(
    canonicalWorktreeRoot,
    repositoryRelativePathFromAbsolute(
      canonicalWorktreeRoot,
      recoveryClaimPath,
    ),
    { allowMissing: true },
  );
  await assertManagedParentStable(
    canonicalWorktreeRoot,
    recoveryClaimPath,
  );
  const noFollow =
    typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let claimHandle;
  try {
    claimHandle = await open(
      recoveryClaimPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        noFollow,
      0o600,
    );
    await claimHandle.writeFile(
      `${canonicalizeJson({
        version: 1,
        breakerNonce: randomUUID(),
        observedOwnerNonce: observedOwner.nonce,
        pid: process.pid,
        hostname: hostname(),
      })}\n`,
    );
    await claimHandle.sync();
  } catch (error) {
    await claimHandle?.close().catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
  await claimHandle.close();

  try {
    const currentMetadata = await lstat(lockPath);
    if (currentMetadata.ino !== observedInode) return false;
    const currentOwner = await readOwner(canonicalWorktreeRoot, lockPath);
    if (currentOwner?.nonce !== observedOwner.nonce) {
      return false;
    }

    // The claim file is deliberately fail-closed if a breaker process dies:
    // no second breaker may touch the canonical owner path until an operator
    // removes that explicit recovery claim. This mirrors ownerless-lock
    // handling and eliminates the final check-to-rename ABA window.
    const ownerPath = path.join(lockPath, "owner.json");
    const tombstoneName =
      `.stale-owner-${observedOwner.nonce}-${randomUUID()}.json`;
    const tombstonePath = path.join(lockPath, tombstoneName);
    try {
      await rename(ownerPath, tombstonePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EEXIST") return false;
      throw error;
    }

    const tombstoneValue = await readManagedJson(
      canonicalWorktreeRoot,
      tombstonePath,
    );
    const tombstoneOwner = isOwnerRecord(tombstoneValue)
      ? tombstoneValue
      : undefined;
    if (tombstoneOwner?.nonce !== observedOwner.nonce) {
      throw new ArtifactStoreError(
        "lock_ownership_lost",
        "Lock owner changed during stale recovery.",
        {
          expectedNonce: observedOwner.nonce,
          actualNonce: tombstoneOwner?.nonce,
        },
      );
    }
    const entries = await readdir(lockPath);
    for (const entry of entries) {
      if (
        entry !== tombstoneName &&
        !entry.startsWith(".owner.json.tmp-")
      ) {
        throw new ArtifactStoreError(
          "lock_ownership_lost",
          "Refusing to remove a stale lock containing unknown files.",
          { lockPath, entry },
        );
      }
    }
    for (const entry of entries) {
      await unlink(path.join(lockPath, entry));
    }
    await rmdir(lockPath);
    await assertManagedParentStable(canonicalWorktreeRoot, lockPath);
    return true;
  } finally {
    await unlink(recoveryClaimPath).catch(() => undefined);
  }
}

export async function acquireStoreLock(
  canonicalWorktreeRoot: string,
  lockPath: string,
  options: LockAcquireOptions = {},
): Promise<StoreLockLease> {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const staleAfterMs = options.staleAfterMs ?? 30_000;
  const pollMinMs = options.pollMinMs ?? 20;
  const pollMaxMs = options.pollMaxMs ?? 60;
  const now = options.now ?? Date.now;
  if (
    timeoutMs < 0 ||
    staleAfterMs <= 0 ||
    pollMinMs <= 0 ||
    pollMaxMs < pollMinMs
  ) {
    throw new TypeError("Invalid lock timing options.");
  }

  const lockRelative = repositoryRelativePathFromAbsolute(
    canonicalWorktreeRoot,
    lockPath,
  );
  await resolveManagedPath(canonicalWorktreeRoot, lockRelative, {
    allowMissing: true,
  });
  await assertManagedParentStable(canonicalWorktreeRoot, lockPath);

  const deadline = now() + timeoutMs;
  const localHostname = hostname();
  const nonce = randomUUID();

  for (;;) {
    let createdInode: number | undefined;
    try {
      await mkdir(lockPath, { mode: 0o700 });
      createdInode = (await lstat(lockPath)).ino;
      const timestamp = new Date(now()).toISOString();
      const owner: LockOwnerRecord = {
        version: 1,
        nonce,
        pid: process.pid,
        hostname: localHostname,
        acquiredAt: timestamp,
        heartbeatAt: timestamp,
      };
      await initializeOwnerFile(canonicalWorktreeRoot, lockPath, owner);
      const initializedMetadata = await lstat(lockPath);
      const initializedOwner = await readOwner(
        canonicalWorktreeRoot,
        lockPath,
      );
      if (
        initializedOwner?.nonce !== nonce
      ) {
        throw new ArtifactStoreError(
          "lock_ownership_lost",
          "Lock directory identity changed while its owner was initialized.",
          {
            lockPath,
            nonce,
            expectedInode: createdInode,
            actualInode: initializedMetadata.ino,
            actualNonce: initializedOwner?.nonce,
          },
        );
      }

      let released = false;
      const assertOwnership = async (): Promise<LockOwnerRecord> => {
        const current = await readOwner(canonicalWorktreeRoot, lockPath);
        if (released || current?.nonce !== nonce) {
          throw new ArtifactStoreError(
            "lock_ownership_lost",
            "The process no longer owns this lock.",
            { lockPath, nonce, actualNonce: current?.nonce },
          );
        }
        return current;
      };

      return {
        lockPath,
        nonce,
        async refresh(): Promise<void> {
          const current = await assertOwnership();
          await atomicWriteJson(
            canonicalWorktreeRoot,
            path.join(lockPath, "owner.json"),
            {
              ...current,
              heartbeatAt: new Date(now()).toISOString(),
            } satisfies LockOwnerRecord,
          );
        },
        async release(): Promise<void> {
          if (released) return;
          await assertOwnership();
          const ownerPath = path.join(lockPath, "owner.json");
          await unlink(ownerPath);
          try {
            await rmdir(lockPath);
          } catch (error) {
            throw new ArtifactStoreError(
              "lock_ownership_lost",
              "Lock directory could not be removed safely.",
              { lockPath, nonce },
              { cause: error },
            );
          }
          released = true;
        },
      };
    } catch (error) {
      if (createdInode !== undefined) {
        const code = (error as NodeJS.ErrnoException).code;
        if (
          code === "EEXIST" ||
          code === "ENOENT" ||
          (error instanceof ArtifactStoreError &&
            error.code === "lock_ownership_lost")
        ) {
          continue;
        }
        await abandonCreatedLock(
          canonicalWorktreeRoot,
          lockPath,
          createdInode,
        ).catch(() => undefined);
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    let guardedLock: string;
    try {
      guardedLock = await resolveManagedPath(
        canonicalWorktreeRoot,
        lockRelative,
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        continue;
      }
      throw error;
    }
    let metadata;
    try {
      metadata = await lstat(guardedLock);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (!metadata.isDirectory()) {
      throw new ArtifactStoreError(
        "unsafe_path",
        "A lock path exists but is not a directory.",
        { lockPath },
      );
    }
    const owner = await readOwner(canonicalWorktreeRoot, guardedLock);
    const heartbeat = owner?.heartbeatAt ?? metadata.mtime.toISOString();
    const stale = now() - Date.parse(heartbeat) >= staleAfterMs;
    // An ownerless directory may still be between mkdir and the exclusive
    // owner-file publication. Automatically breaking that state creates an
    // ABA window in which a live initializer can lose its lock after proving
    // ownership. Fail closed instead; stale recovery is allowed only for a
    // fully identified, same-host owner that is provably dead.
    const safelyDead =
      owner !== undefined &&
      owner.hostname === localHostname &&
      !processIsAlive(owner.pid);
    if (owner !== undefined && stale && safelyDead) {
      const recovered = await recoverStaleLock(
        canonicalWorktreeRoot,
        lockPath,
        owner,
        metadata.ino,
      );
      if (recovered) continue;
    }

    if (now() >= deadline) {
      throw new ArtifactStoreError(
        "lock_timeout",
        "Timed out waiting for the cross-process store lock.",
        {
          lockPath,
          timeoutMs,
          ownerPid: owner?.pid,
          ownerHostname: owner?.hostname,
          ownerNonce: owner?.nonce,
        },
      );
    }
    const jitter =
      pollMinMs + Math.floor(Math.random() * (pollMaxMs - pollMinMs + 1));
    await sleep(Math.min(jitter, Math.max(1, deadline - now())));
  }
}

export async function withStoreLock<T>(
  canonicalWorktreeRoot: string,
  lockPath: string,
  action: (lease: StoreLockLease) => Promise<T>,
  options?: LockAcquireOptions,
): Promise<T> {
  const lease = await acquireStoreLock(
    canonicalWorktreeRoot,
    lockPath,
    options,
  );
  try {
    return await action(lease);
  } finally {
    await lease.release();
  }
}
