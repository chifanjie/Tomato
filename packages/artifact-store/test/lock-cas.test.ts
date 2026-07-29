import {
  mkdir,
  readFile,
  utimes,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { atomicWriteJson } from "../src/atomic.js";
import { sha256Bytes } from "../src/digest.js";
import { acquireStoreLock } from "../src/lock.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_TASK_ID,
  loadRepositorySnapshot,
  makeRepoPulseArtifact,
  openFixtureStore,
} from "./helpers.js";

const ownerOpenGate = vi.hoisted(() => ({
  enabled: false,
  intercepted: false,
  entered: undefined as (() => void) | undefined,
  releasePromise: undefined as Promise<void> | undefined,
}));

const staleOwnerRenameGate = vi.hoisted(() => ({
  enabled: false,
  intercepted: false,
  entered: undefined as (() => void) | undefined,
  releasePromise: undefined as Promise<void> | undefined,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    async open(...args: Parameters<typeof original.open>) {
      const filePath = String(args[0]);
      const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
      const isOwnerInitialization =
        basename === "owner.json" ||
        basename.startsWith(".owner.json.tmp-");
      if (
        ownerOpenGate.enabled &&
        !ownerOpenGate.intercepted &&
        isOwnerInitialization
      ) {
        ownerOpenGate.intercepted = true;
        ownerOpenGate.entered?.();
        await ownerOpenGate.releasePromise;
      }
      return original.open(...args);
    },
    async rename(...args: Parameters<typeof original.rename>) {
      const sourcePath = String(args[0]);
      const destinationPath = String(args[1]);
      const sourceBasename =
        sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
      const destinationBasename =
        destinationPath.slice(destinationPath.lastIndexOf("/") + 1);
      if (
        staleOwnerRenameGate.enabled &&
        !staleOwnerRenameGate.intercepted &&
        sourceBasename === "owner.json" &&
        destinationBasename.startsWith(".stale-owner-")
      ) {
        staleOwnerRenameGate.intercepted = true;
        staleOwnerRenameGate.entered?.();
        await staleOwnerRenameGate.releasePromise;
      }
      return original.rename(...args);
    },
  };
});

afterEach(async () => {
  ownerOpenGate.enabled = false;
  ownerOpenGate.intercepted = false;
  ownerOpenGate.entered = undefined;
  ownerOpenGate.releasePromise = undefined;
  staleOwnerRenameGate.enabled = false;
  staleOwnerRenameGate.intercepted = false;
  staleOwnerRenameGate.entered = undefined;
  staleOwnerRenameGate.releasePromise = undefined;
  await cleanupTemporaryWorktrees();
});

describe("cross-process lock", () => {
  it("never breaks an ownerless lock while its exclusive owner is initializing", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const lockPath = store.layout.taskLock(FIXTURE_TASK_ID);
    let markOwnerOpenEntered!: () => void;
    const ownerOpenEntered = new Promise<void>((resolve) => {
      markOwnerOpenEntered = resolve;
    });
    let releaseOwnerOpen!: () => void;
    ownerOpenGate.releasePromise = new Promise<void>((resolve) => {
      releaseOwnerOpen = resolve;
    });
    ownerOpenGate.entered = markOwnerOpenEntered;
    ownerOpenGate.enabled = true;

    let firstNow = 0;
    const firstAcquire = acquireStoreLock(
      store.layout.worktreeRoot,
      lockPath,
      {
        timeoutMs: 10,
        staleAfterMs: 1_000_000,
        pollMinMs: 1,
        pollMaxMs: 1,
        now: () => firstNow,
      },
    );
    await ownerOpenEntered;

    await expect(
      acquireStoreLock(
        store.layout.worktreeRoot,
        lockPath,
        {
          timeoutMs: 20,
          staleAfterMs: 1,
          pollMinMs: 1,
          pollMaxMs: 1,
          now: () => Date.now() + 60_000,
        },
      ),
    ).rejects.toMatchObject({ code: "lock_timeout" });
    releaseOwnerOpen();
    const firstLease = await firstAcquire;
    await expect(
      readFile(path.join(lockPath, "owner.json"), "utf8"),
    ).resolves.toContain(firstLease.nonce);
    firstNow = 20;
    await firstLease.release();
  });

  it("excludes a real second Node process", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const helper = fileURLToPath(
      new URL("./lock-child.mjs", import.meta.url),
    );
    const child = spawn(process.execPath, [
      helper,
      store.layout.worktreeRoot,
      store.layout.repositoryLock,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let childStderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      childStderr += chunk;
    });
    type ChildExit = {
      code: number | null;
      signal: NodeJS.Signals | null;
      error?: Error;
    };
    const childExit = new Promise<ChildExit>((resolve) => {
      let settled = false;
      const finish = (result: ChildExit): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      child.once("error", (error) =>
        finish({ code: null, signal: null, error }),
      );
      child.once("exit", (code) => {
        finish({ code, signal: child.signalCode });
      });
    });
    try {
      const ready = await new Promise<string>((resolve, reject) => {
        let childStdout = "";
        const timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `lock child did not become ready; stderr=${childStderr}`,
            ),
          );
        }, 5_000);
        const cleanup = (): void => {
          clearTimeout(timeout);
          child.stdout.off("data", onData);
          child.off("error", onError);
          child.off("exit", onPrematureExit);
        };
        const onData = (chunk: Buffer): void => {
          childStdout += chunk.toString("utf8");
          if (childStdout.includes("READY\n")) {
            cleanup();
            resolve(childStdout);
          }
        };
        const onError = (error: Error): void => {
          cleanup();
          reject(error);
        };
        const onPrematureExit = (
          code: number | null,
          signal: NodeJS.Signals | null,
        ): void => {
          cleanup();
          reject(
            new Error(
              `lock child exited before READY ` +
                `(code=${String(code)}, signal=${String(signal)}); ` +
                `stderr=${childStderr}`,
            ),
          );
        };
        child.stdout.on("data", onData);
        child.once("error", onError);
        child.once("exit", onPrematureExit);
      });
      expect(ready).toContain("READY");
      await expect(
        acquireStoreLock(
          store.layout.worktreeRoot,
          store.layout.repositoryLock,
          {
            timeoutMs: 50,
            staleAfterMs: 1,
            pollMinMs: 2,
            pollMaxMs: 4,
          },
        ),
      ).rejects.toMatchObject({ code: "lock_timeout" });

      child.stdin.write("release\n");
      const result = await childExit;
      if (
        result.error !== undefined ||
        result.code !== 0 ||
        result.signal !== null
      ) {
        throw new Error(
          `lock child failed (code=${String(result.code)}, ` +
            `signal=${String(result.signal)}); stderr=${childStderr}`,
          { cause: result.error },
        );
      }

      const acquired = await acquireStoreLock(
        store.layout.worktreeRoot,
        store.layout.repositoryLock,
      );
      await acquired.release();
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await childExit;
      }
    }
  });

  it("times out instead of stealing a live owner even when its heartbeat is stale", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const first = await acquireStoreLock(
      store.layout.worktreeRoot,
      store.layout.repositoryLock,
    );
    try {
      await expect(
        acquireStoreLock(
          store.layout.worktreeRoot,
          store.layout.repositoryLock,
          {
            timeoutMs: 40,
            staleAfterMs: 1,
            pollMinMs: 2,
            pollMaxMs: 3,
          },
        ),
      ).rejects.toMatchObject({ code: "lock_timeout" });
    } finally {
      await first.release();
    }
  });

  it("recovers a stale dead owner through nonce-checked quarantine", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const lockPath = store.layout.taskLock(FIXTURE_TASK_ID);
    await mkdir(lockPath);
    const staleTimestamp = "2000-01-01T00:00:00.000Z";
    await atomicWriteJson(
      store.layout.worktreeRoot,
      path.join(lockPath, "owner.json"),
      {
        version: 1,
        nonce: "stale-owner-nonce",
        pid: 2_147_483_647,
        hostname: (await import("node:os")).hostname(),
        acquiredAt: staleTimestamp,
        heartbeatAt: staleTimestamp,
      },
    );
    await utimes(lockPath, new Date(staleTimestamp), new Date(staleTimestamp));

    const lease = await acquireStoreLock(
      store.layout.worktreeRoot,
      lockPath,
      {
        timeoutMs: 200,
        staleAfterMs: 1,
        pollMinMs: 1,
        pollMaxMs: 2,
      },
    );
    expect(lease.nonce).not.toBe("stale-owner-nonce");
    await lease.release();
  });

  it("does not let a delayed stale breaker steal a newer lock generation", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const lockPath = store.layout.taskLock(FIXTURE_TASK_ID);
    await mkdir(lockPath);
    const staleTimestamp = "2000-01-01T00:00:00.000Z";
    await atomicWriteJson(
      store.layout.worktreeRoot,
      path.join(lockPath, "owner.json"),
      {
        version: 1,
        nonce: "stale-owner-two-breakers",
        pid: 2_147_483_647,
        hostname: (await import("node:os")).hostname(),
        acquiredAt: staleTimestamp,
        heartbeatAt: staleTimestamp,
      },
    );
    await utimes(lockPath, new Date(staleTimestamp), new Date(staleTimestamp));

    let markRenameEntered!: () => void;
    const renameEntered = new Promise<void>((resolve) => {
      markRenameEntered = resolve;
    });
    let releaseRename!: () => void;
    staleOwnerRenameGate.releasePromise = new Promise<void>((resolve) => {
      releaseRename = resolve;
    });
    staleOwnerRenameGate.entered = markRenameEntered;
    staleOwnerRenameGate.enabled = true;

    const delayedBreaker = acquireStoreLock(
      store.layout.worktreeRoot,
      lockPath,
      {
        timeoutMs: 80,
        staleAfterMs: 1,
        pollMinMs: 1,
        pollMaxMs: 1,
      },
    );
    await renameEntered;

    const competingBreaker = acquireStoreLock(
      store.layout.worktreeRoot,
      lockPath,
      {
        timeoutMs: 200,
        staleAfterMs: 1,
        pollMinMs: 1,
        pollMaxMs: 1,
      },
    );
    releaseRename();

    const breakerResults = await Promise.allSettled([
      delayedBreaker,
      competingBreaker,
    ]);
    const fulfilled = breakerResults.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof acquireStoreLock>>
      > => result.status === "fulfilled",
    );
    const rejected = breakerResults.filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "lock_timeout" });
    const winningLease = fulfilled[0]!.value;
    await expect(winningLease.refresh()).resolves.toBeUndefined();
    await winningLease.release();
  });
});

describe("revision CAS and idempotency", () => {
  it("serializes two writers, rejects the loser, and replays the exact idempotent request", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const revisionOne = await makeRepoPulseArtifact(1, "revision one");
    const createRequestDigest = sha256Bytes("create revision one");

    const created = await store.persistArtifact(revisionOne, {
      expectedRevision: 0,
      idempotencyKey: "pulse-create-revision-one",
      requestDigest: createRequestDigest,
    });
    expect(created.replayed).toBe(false);
    const replayed = await store.persistArtifact(revisionOne, {
      expectedRevision: 0,
      idempotencyKey: "pulse-create-revision-one",
      requestDigest: createRequestDigest,
    });
    expect(replayed.replayed).toBe(true);

    await expect(
      store.persistArtifact(revisionOne, {
        expectedRevision: 0,
        idempotencyKey: "pulse-create-revision-one",
        requestDigest: sha256Bytes("different request"),
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });

    const revisionTwoA = await makeRepoPulseArtifact(2, "writer A");
    const revisionTwoB = await makeRepoPulseArtifact(2, "writer B");
    const results = await Promise.allSettled([
      store.persistArtifact(revisionTwoA, {
        expectedRevision: 1,
        idempotencyKey: "writer-a-revision-two",
        requestDigest: sha256Bytes("writer A"),
      }),
      store.persistArtifact(revisionTwoB, {
        expectedRevision: 1,
        idempotencyKey: "writer-b-revision-two",
        requestDigest: sha256Bytes("writer B"),
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejection = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    if (
      rejection?.reason instanceof Error &&
      (rejection.reason as { code?: string }).code !==
        "revision_conflict"
    ) {
      throw rejection.reason;
    }
    expect(rejection?.reason).toMatchObject({ code: "revision_conflict" });

    const persisted = await store.readArtifact("repo_pulse");
    expect(persisted.artifact.revision).toBe(2);
    expect(["feature/writer-A", "feature/writer-B"]).toContain(
      (
        persisted.artifact.payload as {
          repositoryState: { branch?: string };
        }
      ).repositoryState.branch,
    );
    await expect(
      store.readManifest({ verifyArtifacts: true }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("forbids a mutable overwrite that omits expectedRevision", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "first"),
      { expectedRevision: 0 },
    );
    await expect(
      store.persistArtifact(await makeRepoPulseArtifact(2, "overwrite")),
    ).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("fails closed on orphan bytes and reconciles only an identical idempotent retry", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const orphan = await makeRepoPulseArtifact(1, "orphan");
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.repoPulse,
      orphan,
    );

    await expect(
      store.readArtifact("repo_pulse"),
    ).rejects.toMatchObject({ code: "manifest_inconsistent" });
    await expect(
      store.persistArtifact(orphan, { expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: "manifest_inconsistent" });

    const reconciled = await store.persistArtifact(orphan, {
      expectedRevision: 0,
      idempotencyKey: "reconcile-orphan",
      requestDigest: sha256Bytes("reconcile-orphan"),
    });
    expect(reconciled.replayed).toBe(true);
    await expect(
      store.readArtifact("repo_pulse"),
    ).resolves.toMatchObject({
      artifact: { revision: 1 },
      recoveryState: "current",
    });
  });

  it("rejects a high-revision orphan before publishing a Manifest descriptor", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const orphan = await makeRepoPulseArtifact(12, "orphan revision 12");
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.repoPulse,
      orphan,
    );

    await expect(
      store.persistArtifact(orphan, {
        expectedRevision: 0,
        idempotencyKey: "reject-high-revision-orphan",
        requestDigest: sha256Bytes("reject-high-revision-orphan"),
      }),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      details: {
        expectedRevision: 0,
        publishedRevision: 0,
        actualRevision: 12,
      },
    });

    const manifest = await store.readManifest({
      verifyArtifacts: false,
    });
    expect(
      manifest.artifacts.some(
        (descriptor) =>
          descriptor.artifactType === "repo_pulse" &&
          descriptor.artifactId === orphan.artifactId,
      ),
    ).toBe(false);
  });

  it("does not let recover=true promote orphan bytes without a Manifest commit", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const orphan = await makeRepoPulseArtifact(1, "orphan recovery");
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.repoPulse,
      orphan,
    );
    await expect(
      store.readArtifact("repo_pulse", {}, { recover: true }),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
    await expect(
      readFile(store.layout.repoPulse, "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
