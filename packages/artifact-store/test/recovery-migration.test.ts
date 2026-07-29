import {
  readFile,
  readdir,
  rename,
} from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ArtifactManifestV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  type IdempotencyRecordV1,
  type PersistedArtifactV1,
  type TaskArtifactBundleV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  ArtifactStoreError,
  sha256CanonicalJson,
  sha256Bytes,
} from "../src/index.js";
import {
  atomicWriteFile,
  atomicWriteJson,
} from "../src/atomic.js";
import {
  ensureManagedDirectory,
  repositoryRelativePathFromAbsolute,
} from "../src/path-guard.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_TASK_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  loadReferenceEvents,
  loadRepoPulse,
  loadRepositorySnapshot,
  makeRepoPulseArtifact,
  makeRepositorySnapshotArtifact,
  makeTaskManifestArtifact,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

async function openControlledClockStore(root: string): Promise<{
  store: ArtifactStore;
  setClock: (isoTimestamp: string) => void;
}> {
  let currentTime = new Date("2026-07-28T09:00:00.000Z");
  const store = await ArtifactStore.open(root, {
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    clock: () => currentTime,
    lock: {
      timeoutMs: 500,
      staleAfterMs: 2_000,
      pollMinMs: 2,
      pollMaxMs: 5,
    },
  });
  await store.initialize();
  return {
    store,
    setClock(isoTimestamp: string) {
      currentTime = new Date(isoTimestamp);
    },
  };
}

describe("typed reads, backup, quarantine, and recovery", () => {
  it.each(["missing", "corrupt", "descriptor-digest"] as const)(
    "does not trust a ready Manifest whose current Snapshot is %s",
    async (failureMode) => {
      const root = await createTemporaryWorktree(
        `artifact-store-manifest-gate-${failureMode}-`,
      );
      const store = await openFixtureStore(root);
      const snapshot = await loadRepositorySnapshot();
      await store.persistArtifact(snapshot);
      const snapshotPath = store.layout.snapshot(snapshot.sourceSnapshotId);

      if (failureMode === "missing") {
        await rename(snapshotPath, `${snapshotPath}.missing`);
      } else if (failureMode === "corrupt") {
        await atomicWriteFile(
          store.layout.worktreeRoot,
          snapshotPath,
          "{corrupt snapshot",
        );
      } else {
        const manifest = await store.readManifest({
          verifyArtifacts: false,
        });
        await atomicWriteJson(
          store.layout.worktreeRoot,
          store.layout.manifest,
          {
            ...manifest,
            artifacts: manifest.artifacts.map((descriptor) =>
              descriptor.artifactType === "repository_snapshot"
                ? {
                    ...descriptor,
                    contentDigest: sha256Bytes("wrong descriptor digest"),
                  }
                : descriptor,
            ),
          },
        );
      }

      await expect(store.readManifest()).rejects.toBeDefined();
      await expect(openFixtureStore(root)).rejects.toBeDefined();
      await expect(
        store.readManifest({ verifyArtifacts: false }),
      ).resolves.toMatchObject({ status: "ready" });
    },
  );

  it("rejects downstream reads and rolls back writes when published Snapshot bytes disappear", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    await store.persistArtifact(snapshot);
    const pulse = await makeRepoPulseArtifact(1, "before source loss");
    await store.persistArtifact(pulse, { expectedRevision: 0 });
    const originalPulseBytes = await readFile(store.layout.repoPulse);
    const snapshotPath = store.layout.snapshot(snapshot.sourceSnapshotId);
    await rename(snapshotPath, `${snapshotPath}.missing`);

    await expect(store.readArtifact("repo_pulse")).rejects.toMatchObject({
      code: "reference_integrity_failed",
    });
    await expect(
      store.persistArtifact(
        await makeRepoPulseArtifact(2, "must roll back"),
        { expectedRevision: 1 },
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(readFile(store.layout.repoPulse)).resolves.toEqual(
      originalPulseBytes,
    );
  });

  it("rejects idempotent replay and backup recovery when the referenced Snapshot bytes disappear", async () => {
    const replayRoot = await createTemporaryWorktree();
    const replayStore = await openFixtureStore(replayRoot);
    const replaySnapshot = await loadRepositorySnapshot();
    await replayStore.persistArtifact(replaySnapshot);
    const pulse = await makeRepoPulseArtifact(1, "idempotent source gate");
    const requestDigest = sha256Bytes("idempotent source gate");
    const replayOptions = {
      expectedRevision: 0,
      idempotencyKey: "idempotent-source-gate",
      requestDigest,
    };
    await replayStore.persistArtifact(pulse, replayOptions);
    await rename(
      replayStore.layout.snapshot(replaySnapshot.sourceSnapshotId),
      `${replayStore.layout.snapshot(replaySnapshot.sourceSnapshotId)}.missing`,
    );
    await expect(
      replayStore.persistArtifact(pulse, replayOptions),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });

    const recoveryRoot = await createTemporaryWorktree();
    const recoveryStore = await openFixtureStore(recoveryRoot);
    const recoverySnapshot = await loadRepositorySnapshot();
    await recoveryStore.persistArtifact(recoverySnapshot);
    await recoveryStore.persistArtifact(
      await makeRepoPulseArtifact(1, "recovery source one"),
      { expectedRevision: 0 },
    );
    await recoveryStore.persistArtifact(
      await makeRepoPulseArtifact(2, "recovery source two"),
      { expectedRevision: 1 },
    );
    await rename(
      recoveryStore.layout.snapshot(recoverySnapshot.sourceSnapshotId),
      `${recoveryStore.layout.snapshot(recoverySnapshot.sourceSnapshotId)}.missing`,
    );
    await atomicWriteFile(
      recoveryStore.layout.worktreeRoot,
      recoveryStore.layout.repoPulse,
      '{"broken":',
    );
    await expect(
      recoveryStore.readArtifact("repo_pulse", {}, { recover: true }),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it.each(["after_rename", "after_directory_fsync"] as const)(
    "keeps a published Repo Pulse after a committed Manifest %s ambiguity and reconciles its retry",
    async (failureStage) => {
      const root = await createTemporaryWorktree(
        `artifact-store-manifest-${failureStage}-`,
      );
      const store = await openFixtureStore(root);
      await store.persistArtifact(await loadRepositorySnapshot());
      await store.persistArtifact(
        await makeRepoPulseArtifact(1, "before commit ambiguity"),
        { expectedRevision: 0 },
      );
      const revisionTwo = await makeRepoPulseArtifact(
        2,
        `committed ${failureStage}`,
      );
      const options = {
        expectedRevision: 1,
        idempotencyKey: `pulse-${failureStage}`,
        requestDigest: sha256Bytes(`pulse-${failureStage}`),
        manifestWrite: {
          faultInjector({ stage }: { stage: string }) {
            if (stage === failureStage) {
              throw new Error(`ambiguous ${failureStage}`);
            }
          },
        },
      };

      await expect(
        store.persistArtifact(revisionTwo, options),
      ).rejects.toMatchObject({
        details: {
          committed: true,
          targetPath: store.layout.manifest,
        },
      });
      await expect(store.readArtifact("repo_pulse")).resolves.toMatchObject({
        artifact: {
          revision: 2,
          contentDigest: revisionTwo.contentDigest,
        },
      });
      await expect(
        store.persistArtifact(revisionTwo, options),
      ).resolves.toMatchObject({
        artifact: { revision: 2 },
        replayed: true,
      });
    },
  );

  it("rolls back Repo Pulse bytes and Manifest when publication fails before rename", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const revisionOne = await makeRepoPulseArtifact(
      1,
      "before pre-rename failure",
    );
    await store.persistArtifact(revisionOne, { expectedRevision: 0 });
    const revisionTwo = await makeRepoPulseArtifact(
      2,
      "pre-rename rollback",
    );

    await expect(
      store.persistArtifact(revisionTwo, {
        expectedRevision: 1,
        idempotencyKey: "pulse-before-rename",
        requestDigest: sha256Bytes("pulse-before-rename"),
        manifestWrite: {
          faultInjector({ stage }) {
            if (stage === "before_rename") {
              throw new Error("Manifest was not published");
            }
          },
        },
      }),
    ).rejects.toMatchObject({
      details: {
        committed: false,
        targetPath: store.layout.manifest,
      },
    });
    await expect(store.readArtifact("repo_pulse")).resolves.toMatchObject({
      artifact: {
        revision: 1,
        contentDigest: revisionOne.contentDigest,
      },
    });
  });

  it("recovers the newest valid backup and synchronizes the read-only descriptor identity", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "revision one"),
      { expectedRevision: 0 },
    );
    await store.persistArtifact(
      await makeRepoPulseArtifact(2, "revision two"),
      { expectedRevision: 1 },
    );
    await store.persistArtifact(
      await makeRepoPulseArtifact(3, "revision three"),
      { expectedRevision: 2 },
    );

    const pulsePath = store.layout.artifact("repo_pulse");
    await atomicWriteFile(
      store.layout.worktreeRoot,
      pulsePath,
      '{"broken":',
    );
    const recovered = await store.readArtifact(
      "repo_pulse",
      {},
      { recover: true },
    );
    expect(recovered.recoveryState).toBe("read_only_recovery");
    expect(recovered.artifact.revision).toBe(2);

    const manifest = await store.readManifest({ verifyArtifacts: true });
    const descriptor = manifest.artifacts.find(
      (candidate) => candidate.artifactType === "repo_pulse",
    );
    expect(descriptor).toMatchObject({
      revision: 2,
      contentDigest: recovered.artifact.contentDigest,
      state: "read_only_recovery",
      freshness: "stale",
    });
    await expect(
      store.persistArtifact(
        await makeRepoPulseArtifact(3, "promote attempt"),
        { expectedRevision: 2 },
      ),
    ).rejects.toMatchObject({ code: "revision_conflict" });
    await expect(
      store.persistArtifact(
        await makeRepoPulseArtifact(3, "promoted"),
        { expectedRevision: 2, promoteRecovery: true },
      ),
    ).resolves.toMatchObject({ artifact: { revision: 3 } });

    const quarantineEntries = await readdir(
      path.join(store.layout.quarantine, "artifacts"),
    );
    expect(quarantineEntries.some((entry) => entry.includes("corrupt"))).toBe(
      true,
    );
  });

  it("orders backups by durable sequence across clock rollback and restores the newest valid revision", async () => {
    const root = await createTemporaryWorktree();
    const { store, setClock } = await openControlledClockStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    setClock("2030-01-01T00:00:00.000Z");
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "revision one"),
      { expectedRevision: 0 },
    );
    setClock("2020-01-01T00:00:00.000Z");
    await store.persistArtifact(
      await makeRepoPulseArtifact(2, "revision two"),
      { expectedRevision: 1 },
    );
    setClock("2010-01-01T00:00:00.000Z");
    await store.persistArtifact(
      await makeRepoPulseArtifact(3, "revision three"),
      { expectedRevision: 2 },
    );

    const pulsePath = store.layout.artifact("repo_pulse");
    const relativePath = repositoryRelativePathFromAbsolute(
      store.layout.worktreeRoot,
      pulsePath,
    );
    const bucket = sha256Bytes(relativePath).slice("sha256:".length);
    const backupNames = (
      await readdir(path.join(store.layout.backups, bucket))
    )
      .filter((name) => name.endsWith(".bak"))
      .sort();
    expect(backupNames).toHaveLength(2);
    expect(
      backupNames.every((name) =>
        /^seq-\d{24}-\d{16}-.+\.bak$/u.test(name),
      ),
    ).toBe(true);
    expect(
      BigInt(backupNames[0]!.split("-")[1]!) <
        BigInt(backupNames[1]!.split("-")[1]!),
    ).toBe(true);
    expect(
      backupNames[0]!.split("-")[2]!.localeCompare(
        backupNames[1]!.split("-")[2]!,
      ),
    ).toBeGreaterThan(0);

    await atomicWriteFile(
      store.layout.worktreeRoot,
      pulsePath,
      '{"broken":',
    );
    const recovered = await store.readArtifact(
      "repo_pulse",
      {},
      { recover: true },
    );
    expect(recovered).toMatchObject({
      recoveryState: "read_only_recovery",
      artifact: { revision: 2 },
    });
  });

  it("requires a committed descriptor before restoring an Artifact backup", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "revision one"),
      { expectedRevision: 0 },
    );
    await store.persistArtifact(
      await makeRepoPulseArtifact(2, "revision two"),
      { expectedRevision: 1 },
    );

    const manifest = await store.readManifest();
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.manifest,
      {
        ...manifest,
        artifacts: manifest.artifacts.filter(
          (descriptor) => descriptor.artifactType !== "repo_pulse",
        ),
      },
    );
    const pulsePath = store.layout.artifact("repo_pulse");
    await atomicWriteFile(
      store.layout.worktreeRoot,
      pulsePath,
      '{"broken":',
    );

    await expect(
      store.readArtifact(
        "repo_pulse",
        {},
        { recover: true },
      ),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
    await expect(readFile(pulsePath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("recovers an immutable revision-zero Snapshot from its first-publication backup", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    const written = await store.persistArtifact(snapshot);
    expect(written.backupPath).toEqual(expect.any(String));

    const snapshotPath = store.layout.snapshot(snapshot.sourceSnapshotId);
    await atomicWriteFile(
      store.layout.worktreeRoot,
      snapshotPath,
      '{"broken":',
    );
    await expect(
      store.readArtifact(
        "repository_snapshot",
        { snapshotId: snapshot.sourceSnapshotId },
        { recover: true },
      ),
    ).resolves.toMatchObject({
      artifact: {
        artifactId: snapshot.artifactId,
        revision: 0,
        contentDigest: snapshot.contentDigest,
      },
      state: "read_only_recovery",
      freshness: "stale",
      recoveryState: "read_only_recovery",
    });
  });

  it("keeps digest-pinned dependents intact and invalidates them when an immutable Snapshot and its backup are corrupt", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await makeRepoPulseArtifact(1, "dependent"));

    const manifest = await store.readManifest();
    const snapshotDescriptor = manifest.artifacts.find(
      (descriptor) => descriptor.artifactType === "repository_snapshot",
    )!;
    const pulseDescriptor = manifest.artifacts.find(
      (descriptor) => descriptor.artifactType === "repo_pulse",
    )!;
    const dependency = pulseDescriptor.dependencies.find(
      (candidate) => candidate.artifactId === snapshotDescriptor.artifactId,
    );
    expect(dependency).toMatchObject({
      artifactId: snapshotDescriptor.artifactId,
      requiredDigest: snapshotDescriptor.contentDigest,
    });

    const snapshotPath = store.layout.snapshot(
      snapshotDescriptor.sourceSnapshotId!,
    );
    const snapshotRelative = repositoryRelativePathFromAbsolute(
      store.layout.worktreeRoot,
      snapshotPath,
    );
    const backupBucket = sha256Bytes(snapshotRelative).slice(
      "sha256:".length,
    );
    const backupDirectory = path.join(store.layout.backups, backupBucket);
    const backupNames = (await readdir(backupDirectory)).filter((name) =>
      name.endsWith(".bak"),
    );
    expect(backupNames).toHaveLength(1);
    for (const backupName of backupNames) {
      await atomicWriteFile(
        store.layout.worktreeRoot,
        path.join(backupDirectory, backupName),
        '{"broken backup":',
      );
    }
    await atomicWriteFile(
      store.layout.worktreeRoot,
      snapshotPath,
      '{"broken":',
    );
    await expect(
      store.readArtifact(
        "repository_snapshot",
        { snapshotId: snapshotDescriptor.sourceSnapshotId },
        { recover: true },
      ),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });

    const failed = await store.readManifest({ verifyArtifacts: false });
    const failedPulse = failed.artifacts.find(
      (descriptor) => descriptor.artifactType === "repo_pulse",
    );
    const failedSnapshot = failed.artifacts.find(
      (descriptor) => descriptor.artifactType === "repository_snapshot",
    );
    expect(failedPulse).toMatchObject({
      revision: 1,
      contentDigest: pulseDescriptor.contentDigest,
      state: "current",
      freshness: "invalid",
      dependencies: [dependency],
    });
    expect(failedSnapshot).toMatchObject({
      revision: 0,
      contentDigest: snapshotDescriptor.contentDigest,
      state: "corrupt",
      freshness: "invalid",
    });
  });

  it("allows only byte-identical revision-zero Snapshot replay and reports immutable identity conflicts explicitly", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    const snapshotPath = store.layout.snapshot(snapshot.sourceSnapshotId);
    await store.persistArtifact(snapshot);
    const originalBytes = await readFile(snapshotPath);

    await expect(store.persistArtifact(snapshot)).resolves.toMatchObject({
      replayed: true,
      artifact: { revision: 0 },
    });
    await expect(
      store.persistArtifact(
        await makeRepositorySnapshotArtifact(
          0,
          "same identity changed payload",
        ),
        { expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      details: {
        currentRevision: 0,
        attemptedRevision: 0,
      },
    });
    await expect(
      store.persistArtifact(
        await makeRepositorySnapshotArtifact(
          1,
          "same identity revision one",
        ),
        { expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      details: { actualRevision: 1, requiredRevision: 0 },
    });

    const nextPayload = {
      ...snapshot.payload,
      snapshotId: "snapshot:next",
      createdAt: "2026-07-28T10:00:00Z",
      limitations: ["new immutable identity"],
    };
    const reusedArtifactId = RepositorySnapshotArtifactV1Schema.parse({
      ...snapshot,
      sourceSnapshotId: nextPayload.snapshotId,
      createdAt: nextPayload.createdAt,
      contentDigest: sha256CanonicalJson(nextPayload),
      payload: nextPayload,
    });
    await expect(
      store.persistArtifact(reusedArtifactId),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      details: {
        artifactId: snapshot.artifactId,
        existingSnapshotId: snapshot.sourceSnapshotId,
      },
    });
    await expect(readFile(snapshotPath)).resolves.toEqual(originalBytes);

    await rename(snapshotPath, `${snapshotPath}.missing`);
    await expect(
      store.persistArtifact(
        await makeRepositorySnapshotArtifact(
          0,
          "missing immutable Snapshot replacement",
        ),
      ),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      details: {
        recoveryRequired: true,
        existingSnapshotId: snapshot.sourceSnapshotId,
      },
    });
  });

  it("exposes stale and historical read metadata and rejects explicitly invalid descriptors", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const firstSnapshot = RepositorySnapshotArtifactV1Schema.parse(
      await loadRepositorySnapshot(),
    );
    await store.persistArtifact(firstSnapshot);
    await store.persistArtifact(await loadRepoPulse());

    const nextPayload = {
      ...firstSnapshot.payload,
      snapshotId: "snapshot:next-readable-state",
      createdAt: "2026-07-28T11:00:00Z",
      limitations: ["next immutable snapshot"],
    };
    const nextSnapshot = RepositorySnapshotArtifactV1Schema.parse({
      ...firstSnapshot,
      artifactId: "artifact:repository-snapshot:next-readable-state",
      sourceSnapshotId: nextPayload.snapshotId,
      createdAt: nextPayload.createdAt,
      contentDigest: sha256CanonicalJson(nextPayload),
      payload: nextPayload,
    });
    await store.persistArtifact(nextSnapshot);

    await expect(
      store.readArtifact("repository_snapshot", {
        snapshotId: firstSnapshot.sourceSnapshotId,
      }),
    ).resolves.toMatchObject({
      state: "historical",
      freshness: "stale",
      latestSnapshotId: nextSnapshot.sourceSnapshotId,
      recoveryState: "historical",
    });
    await expect(store.readArtifact("repo_pulse")).resolves.toMatchObject({
      state: "current",
      freshness: "stale",
      latestSnapshotId: nextSnapshot.sourceSnapshotId,
      recoveryState: "current",
    });

    const manifest = await store.readManifest();
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.manifest,
      {
        ...manifest,
        status: "error",
        reasons: ["Repo Pulse was invalidated for the read-safety test."],
        artifacts: manifest.artifacts.map((descriptor) =>
          descriptor.artifactType === "repo_pulse"
            ? { ...descriptor, freshness: "invalid" as const }
            : descriptor,
        ),
      },
    );
    await expect(store.readArtifact("repo_pulse")).rejects.toMatchObject({
      code: "manifest_inconsistent",
    });
  });

  it("rejects unknown schema and digest mismatch before bytes become trusted", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    const pulseArtifact = await makeRepoPulseArtifact(1, "typed read");
    await store.persistArtifact(pulseArtifact, { expectedRevision: 0 });
    const pulsePath = store.layout.artifact("repo_pulse");

    await atomicWriteJson(store.layout.worktreeRoot, pulsePath, {
      ...pulseArtifact,
      schemaVersion: 999,
    });
    await expect(
      store.readArtifact("repo_pulse"),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });

    await atomicWriteJson(store.layout.worktreeRoot, pulsePath, {
      ...pulseArtifact,
      payload: {
        ...pulseArtifact.payload,
        evaluatedAt: "2026-07-28T10:00:00Z",
      },
    });
    await expect(
      store.readArtifact("repo_pulse"),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
  });

  it("skips file-inconsistent Manifest backups and restores an older valid publication", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "first manifest backup"),
      { expectedRevision: 0 },
    );
    await store.persistArtifact(
      await makeRepoPulseArtifact(2, "inconsistent newest backup"),
      { expectedRevision: 1 },
    );
    await atomicWriteFile(
      store.layout.worktreeRoot,
      store.layout.manifest,
      "{bad manifest",
    );

    const reopened = await openFixtureStore(root);
    const restored = await reopened.readManifest();
    expect(() => ArtifactManifestV1Schema.parse(restored)).not.toThrow();
    expect(restored.repositoryId).toBe("repository:fixture");
    expect(
      restored.artifacts.some(
        (descriptor) => descriptor.artifactType === "repo_pulse",
      ),
    ).toBe(false);
  });

  it("recovers a missing Manifest from the newest file-consistent backup", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "orphan after manifest loss"),
      { expectedRevision: 0 },
    );
    await rename(
      store.layout.manifest,
      `${store.layout.manifest}.missing`,
    );

    const reopened = await openFixtureStore(root);
    const restored = await reopened.readManifest();
    expect(restored).toMatchObject({
      status: "ready",
      latestSnapshotId: "snapshot:actual",
    });
    expect(
      restored.artifacts.map((descriptor) => descriptor.artifactType),
    ).toEqual(["repository_snapshot"]);
  });

  it("preserves a corrupt Manifest when no valid backup exists across repeated startup attempts", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await atomicWriteFile(
      store.layout.worktreeRoot,
      store.layout.manifest,
      "{bad manifest",
    );

    await expect(openFixtureStore(root)).rejects.toMatchObject({
      code: "artifact_corrupt",
    });
    await expect(openFixtureStore(root)).rejects.toMatchObject({
      code: "artifact_corrupt",
    });
    await expect(
      readFile(store.layout.manifest, "utf8"),
    ).resolves.toBe("{bad manifest");
  });
});

describe("isolated migrations", () => {
  it("validates in isolation and atomically switches a successful migration", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await ensureManagedDirectory(
      store.layout.worktreeRoot,
      ".understand-code/legacy",
    );
    const legacyPath = path.join(
      store.layout.storeRoot,
      "legacy",
      "fixture.json",
    );
    await atomicWriteJson(store.layout.worktreeRoot, legacyPath, {
      version: "1",
      value: "before",
    });
    let asyncValidationCompleted = false;
    const result = await store.migrateJson({
      relativePath: ".understand-code/legacy/fixture.json",
      format: "fixture",
      fromVersion: "1",
      toVersion: "2",
      steps: [
        {
          format: "fixture",
          fromVersion: "1",
          toVersion: "2",
          migrate(input) {
            return { ...(input as Record<string, unknown>), version: "2" };
          },
        },
      ],
      async validate(value) {
        await Promise.resolve();
        expect(value).toMatchObject({ version: "2", value: "before" });
        asyncValidationCompleted = true;
      },
    });
    expect(result).toMatchObject({
      migrated: true,
      appliedVersions: ["2"],
    });
    expect(asyncValidationCompleted).toBe(true);
    expect(JSON.parse(await readFile(legacyPath, "utf8"))).toEqual({
      value: "before",
      version: "2",
    });
  });

  it("rolls back validation, migration, post-switch, and committed-write failures", async () => {
    const failureModes = [
      "migration",
      "validation",
      "post-switch",
      "after-rename",
      "after-rename-store-error",
    ] as const;
    for (const failureMode of failureModes) {
      const root = await createTemporaryWorktree(
        `artifact-store-migration-${failureMode}-`,
      );
      const store = await openFixtureStore(root);
      await ensureManagedDirectory(
        store.layout.worktreeRoot,
        ".understand-code/legacy",
      );
      const target = path.join(
        store.layout.storeRoot,
        "legacy",
        "fixture.json",
      );
      const original = '{"version":"1","value":"original"}\n';
      await atomicWriteFile(store.layout.worktreeRoot, target, original);
      await expect(
        store.migrateJson({
          relativePath: ".understand-code/legacy/fixture.json",
          format: "fixture",
          fromVersion: "1",
          toVersion: "2",
          steps: [
            {
              format: "fixture",
              fromVersion: "1",
              toVersion: "2",
              migrate(input) {
                if (failureMode === "migration") {
                  throw new Error("migration failed");
                }
                return {
                  ...(input as Record<string, unknown>),
                  version: "2",
                };
              },
            },
          ],
          validate() {
            if (failureMode === "validation") {
              throw new Error("validation failed");
            }
          },
          ...(failureMode === "post-switch"
            ? {
                afterSwitch() {
                  throw new Error("post-switch failed");
                },
              }
            : {}),
          ...(failureMode === "after-rename" ||
          failureMode === "after-rename-store-error"
            ? {
                write: {
                  faultInjector({ stage }: { stage: string }) {
                    if (stage === "after_rename") {
                      if (failureMode === "after-rename-store-error") {
                        throw new ArtifactStoreError(
                          "unsafe_path",
                          "guard failed after rename",
                        );
                      }
                      throw new Error("crash after rename");
                    }
                  },
                },
              }
            : {}),
        }),
      ).rejects.toMatchObject({ code: "migration_failed" });
      await expect(readFile(target, "utf8")).resolves.toBe(original);
    }
  });

  it("updates a published leaf Artifact and its Manifest descriptor in one migration transaction", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "before migration"),
      { expectedRevision: 0 },
    );
    const migratedPulse = await makeRepoPulseArtifact(2, "after migration");

    const result = await store.migrateJson({
      relativePath: ".understand-code/repo-pulse.json",
      format: "repo-pulse-fixture",
      fromVersion: "1",
      toVersion: "2",
      steps: [
        {
          format: "repo-pulse-fixture",
          fromVersion: "1",
          toVersion: "2",
          migrate() {
            return migratedPulse;
          },
        },
      ],
      async validate(value) {
        await Promise.resolve();
        RepoPulseArtifactV1Schema.parse(value);
      },
    });

    expect(result).toMatchObject({
      migrated: true,
      appliedVersions: ["2"],
      backupPath: expect.any(String),
    });
    await expect(store.readArtifact("repo_pulse")).resolves.toMatchObject({
      artifact: {
        revision: 2,
        contentDigest: migratedPulse.contentDigest,
      },
      recoveryState: "current",
    });
    const manifest = await store.readManifest();
    expect(
      manifest.artifacts.find(
        (descriptor) => descriptor.artifactType === "repo_pulse",
      ),
    ).toMatchObject({
      revision: 2,
      contentDigest: migratedPulse.contentDigest,
      generatedAt: migratedPulse.createdAt,
    });
  });

  it("rolls back both published Artifact and Manifest when the commit-point write fails", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(
      await makeRepoPulseArtifact(1, "before failed migration"),
      { expectedRevision: 0 },
    );
    const migratedPulse = await makeRepoPulseArtifact(
      2,
      "rolled back migration",
    );
    const originalArtifactBytes = await readFile(store.layout.repoPulse);
    const originalManifestBytes = await readFile(store.layout.manifest);

    await expect(
      store.migrateJson({
        relativePath: ".understand-code/repo-pulse.json",
        format: "repo-pulse-fixture",
        fromVersion: "1",
        toVersion: "2",
        steps: [
          {
            format: "repo-pulse-fixture",
            fromVersion: "1",
            toVersion: "2",
            migrate() {
              return migratedPulse;
            },
          },
        ],
        validate(value) {
          RepoPulseArtifactV1Schema.parse(value);
        },
        manifestWrite: {
          faultInjector({ stage }) {
            if (stage === "before_rename") {
              throw new Error("Manifest commit point unavailable");
            }
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "migration_failed",
      details: {
        targetSwitched: true,
        manifestCommitted: false,
        rolledBack: true,
      },
    });
    await expect(readFile(store.layout.repoPulse)).resolves.toEqual(
      originalArtifactBytes,
    );
    await expect(readFile(store.layout.manifest)).resolves.toEqual(
      originalManifestBytes,
    );
  });

  it("rejects in-place migration of an immutable published Snapshot without changing either file", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await makeRepositorySnapshotArtifact(
      0,
      "before pinned migration",
    );
    await store.persistArtifact(snapshot);
    await store.persistArtifact(await loadRepoPulse());
    const migratedSnapshot = await makeRepositorySnapshotArtifact(
      1,
      "after pinned migration",
    );
    const snapshotPath = store.layout.snapshot(snapshot.sourceSnapshotId);
    const snapshotRelative = repositoryRelativePathFromAbsolute(
      store.layout.worktreeRoot,
      snapshotPath,
    );
    const originalArtifactBytes = await readFile(snapshotPath);
    const originalManifestBytes = await readFile(store.layout.manifest);

    await expect(
      store.migrateJson({
        relativePath: snapshotRelative,
        format: "snapshot-fixture",
        fromVersion: "1",
        toVersion: "2",
        steps: [
          {
            format: "snapshot-fixture",
            fromVersion: "1",
            toVersion: "2",
            migrate() {
              return migratedSnapshot;
            },
          },
        ],
        validate() {},
      }),
    ).rejects.toMatchObject({
      code: "migration_failed",
      details: {
        artifactId: snapshot.artifactId,
        sourceSnapshotId: snapshot.sourceSnapshotId,
        migrationPolicy: "create_new_snapshot",
      },
    });
    await expect(readFile(snapshotPath)).resolves.toEqual(
      originalArtifactBytes,
    );
    await expect(readFile(store.layout.manifest)).resolves.toEqual(
      originalManifestBytes,
    );
  });

  it("rejects Task-scoped and arbitrary unpublished migration targets", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await ensureManagedDirectory(
      store.layout.worktreeRoot,
      `.understand-code/tasks/${FIXTURE_TASK_ID}`,
    );
    await atomicWriteJson(
      store.layout.worktreeRoot,
      store.layout.task(FIXTURE_TASK_ID).taskManifest,
      { version: "1" },
    );
    const arbitraryPath = path.join(
      store.layout.storeRoot,
      "arbitrary.json",
    );
    await atomicWriteJson(store.layout.worktreeRoot, arbitraryPath, {
      version: "1",
    });
    const migration = {
      format: "fixture",
      fromVersion: "1",
      toVersion: "2",
      steps: [
        {
          format: "fixture",
          fromVersion: "1",
          toVersion: "2",
          migrate(value: unknown) {
            return {
              ...(value as Record<string, string>),
              version: "2",
            };
          },
        },
      ],
      validate() {},
    };

    await expect(
      store.migrateJson({
        ...migration,
        relativePath:
          `.understand-code/tasks/${FIXTURE_TASK_ID}/task.json`,
      }),
    ).rejects.toMatchObject({ code: "migration_failed" });
    await expect(
      store.migrateJson({
        ...migration,
        relativePath: ".understand-code/arbitrary.json",
      }),
    ).rejects.toMatchObject({ code: "migration_failed" });
  });
});

describe("trusted Task bundles", () => {
  async function loadTaskArtifacts(): Promise<PersistedArtifactV1[]> {
    return Promise.all(
      [
        "task.json",
        "task-brief.json",
        "claims.json",
        "evidence.json",
        "impact.json",
        "change-check.json",
        "verification.json",
      ].map((name) =>
        loadContractFixture<PersistedArtifactV1>(`reference/${name}`),
      ),
    );
  }

  async function loadContextlessTaskTransaction() {
    const fullBundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const reference = await loadContractFixture<PersistedArtifactV1>(
      "reference/task.json",
    );
    if (reference.artifactType !== "task_manifest") {
      throw new TypeError("Reference Task fixture is not a Task Manifest.");
    }
    const {
      currentChangeCheckId: _currentChangeCheckId,
      currentChangeCheckRevision: _currentChangeCheckRevision,
      ...basePayload
    } = reference.payload;
    const event = fullBundle.events[0]!;
    const idempotencyRecord = fullBundle.idempotencyRecords[0]!;
    const payload = {
      ...basePayload,
      status: "created" as const,
      revision: 1,
      updatedAt: event.occurredAt,
    };
    const artifact = TaskManifestArtifactV1Schema.parse({
      ...reference,
      revision: 1,
      createdAt: event.occurredAt,
      contentDigest: sha256CanonicalJson(payload),
      payload,
    });
    return {
      artifact,
      event,
      idempotencyRecord,
      input: {
        artifacts: [artifact],
        events: [event],
        idempotencyRecords: [idempotencyRecord],
      },
      options: {
        expectedRevision: 0,
        idempotencyKey: idempotencyRecord.idempotencyKey,
        requestDigest: idempotencyRecord.requestDigest,
      },
    };
  }

  it("publishes a fully validated cross-ledger Task transaction and replays it idempotently", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await loadRepoPulse());
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;
    const input = {
      artifacts,
      events: bundle.events,
      idempotencyRecords: bundle.idempotencyRecords,
    };
    const options = {
      expectedRevision: 0,
      idempotencyKey: control.idempotencyKey,
      requestDigest: control.requestDigest,
    };
    const written = await store.persistTaskBundle(input, options);
    expect(written).toMatchObject({
      replayed: false,
      bundle: { manifest: { revision: 12, status: "verified" } },
    });
    const replay = await store.persistTaskBundle(input, options);
    expect(replay.replayed).toBe(true);

    for (const artifact of artifacts) {
      await expect(
        store.readArtifact(artifact.artifactType, {
          taskId: FIXTURE_TASK_ID,
        }),
      ).resolves.toMatchObject({
        artifact: {
          artifactId: artifact.artifactId,
          contentDigest: artifact.contentDigest,
        },
      });
    }
    const manifest = await store.readManifest();
    expect(manifest).toMatchObject({ status: "ready" });
    const expectedDependencyTypes = new Map<string, string[]>([
      ["task_manifest", ["repository_snapshot", "repo_pulse"]],
      ["claim_ledger", ["task_manifest"]],
      ["evidence_ledger", ["task_manifest", "claim_ledger"]],
      ["impact", ["claim_ledger", "evidence_ledger"]],
      [
        "task_brief",
        ["task_manifest", "claim_ledger", "evidence_ledger", "impact"],
      ],
      ["change_check", ["task_brief", "evidence_ledger", "impact"]],
      ["verification", ["change_check", "claim_ledger"]],
      ["task_event_log", ["task_manifest"]],
    ]);
    for (const [artifactType, dependencyTypes] of expectedDependencyTypes) {
      const descriptor = manifest.artifacts.find(
        (candidate) => candidate.artifactType === artifactType,
      );
      expect(descriptor, artifactType).toBeDefined();
      const dependencyTargets = descriptor!.dependencies.map(
        (dependency) =>
          manifest.artifacts.find(
            (candidate) =>
              candidate.artifactId === dependency.artifactId,
          )!,
      );
      expect(
        dependencyTargets.map((target) => target.artifactType).sort(),
      ).toEqual([...dependencyTypes].sort());
      for (const dependency of descriptor!.dependencies) {
        const target = manifest.artifacts.find(
          (candidate) => candidate.artifactId === dependency.artifactId,
        )!;
        expect(dependency).toMatchObject({
          requiredDigest: target.contentDigest,
          requiredSnapshotId: target.sourceSnapshotId,
        });
      }
    }
  });

  it("keeps a Task revision published after a committed Manifest ambiguity and reconciles the retry", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await loadRepoPulse());
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;
    const input = {
      artifacts,
      events: bundle.events,
      idempotencyRecords: bundle.idempotencyRecords,
    };
    const options = {
      expectedRevision: 0,
      idempotencyKey: control.idempotencyKey,
      requestDigest: control.requestDigest,
      manifestWrite: {
        faultInjector({ stage }: { stage: string }) {
          if (stage === "after_rename") {
            throw new Error("Task Manifest commit is ambiguous");
          }
        },
      },
    };

    await expect(
      store.persistTaskBundle(input, options),
    ).rejects.toMatchObject({
      details: {
        committed: true,
        targetPath: store.layout.manifest,
      },
    });
    await expect(
      store.readArtifact("task_manifest", { taskId: FIXTURE_TASK_ID }),
    ).resolves.toMatchObject({
      artifact: { revision: 12 },
      state: "current",
    });
    await expect(
      store.persistTaskBundle(input, options),
    ).resolves.toMatchObject({
      bundle: { manifest: { revision: 12 } },
      replayed: true,
    });
  });

  it("fails closed when any Task dependency, Event log, or source Snapshot disappears", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    await store.persistArtifact(snapshot);
    await store.persistArtifact(await loadRepoPulse());
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;
    const input = {
      artifacts,
      events: bundle.events,
      idempotencyRecords: bundle.idempotencyRecords,
    };
    const options = {
      expectedRevision: 0,
      idempotencyKey: control.idempotencyKey,
      requestDigest: control.requestDigest,
    };
    await store.persistTaskBundle(input, options);

    const claimsPath = store.layout.task(FIXTURE_TASK_ID).claims;
    const missingClaimsPath = `${claimsPath}.missing`;
    await rename(claimsPath, missingClaimsPath);
    await expect(
      store.readArtifact("task_brief", { taskId: FIXTURE_TASK_ID }),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      store.appendTaskEvent(FIXTURE_TASK_ID, bundle.events.at(-1)!),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await rename(missingClaimsPath, claimsPath);

    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    const missingEventsPath = `${eventsPath}.missing`;
    await rename(eventsPath, missingEventsPath);
    await expect(
      store.readArtifact("task_brief", { taskId: FIXTURE_TASK_ID }),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await rename(missingEventsPath, eventsPath);

    await rename(
      store.layout.snapshot(snapshot.sourceSnapshotId),
      `${store.layout.snapshot(snapshot.sourceSnapshotId)}.missing`,
    );
    await expect(
      store.persistTaskBundle(input, options),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
  });

  it("rejects Task single-file recovery even when a valid older leaf backup exists", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    await store.persistArtifact(await loadRepositorySnapshot());
    await store.persistArtifact(await loadRepoPulse());
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;
    await store.persistTaskBundle(
      {
        artifacts,
        events: bundle.events,
        idempotencyRecords: bundle.idempotencyRecords,
      },
      {
        expectedRevision: 0,
        idempotencyKey: control.idempotencyKey,
        requestDigest: control.requestDigest,
      },
    );

    const verification = artifacts.find(
      (artifact) => artifact.artifactType === "verification",
    )!;
    const verificationPath =
      store.layout.task(FIXTURE_TASK_ID).verification;
    const verificationRelative = repositoryRelativePathFromAbsolute(
      store.layout.worktreeRoot,
      verificationPath,
    );
    const bucket = sha256Bytes(verificationRelative).slice(
      "sha256:".length,
    );
    const backupDirectory = await ensureManagedDirectory(
      store.layout.worktreeRoot,
      `.understand-code/.recovery/backups/${bucket}`,
    );
    await atomicWriteJson(
      store.layout.worktreeRoot,
      path.join(backupDirectory, "seq-000000000000000000000001-test.bak"),
      { ...verification, revision: 11 },
    );
    await atomicWriteFile(
      store.layout.worktreeRoot,
      verificationPath,
      '{"broken":',
    );

    await expect(
      store.readArtifact(
        "verification",
        { taskId: FIXTURE_TASK_ID },
        { recover: true },
      ),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      details: { recoveryPolicy: "whole_task_required" },
    });
    const manifest = await store.readManifest({ verifyArtifacts: false });
    expect(
      manifest.artifacts.find(
        (descriptor) => descriptor.artifactType === "verification",
      ),
    ).toMatchObject({
      revision: 12,
      state: "current",
    });
  });

  it("rejects standalone Task writes even with a Snapshot and rejects contextual bundles without one", async () => {
    const standaloneRoot = await createTemporaryWorktree();
    const standaloneStore = await openFixtureStore(standaloneRoot);
    await standaloneStore.persistArtifact(await loadRepositorySnapshot());
    await expect(
      standaloneStore.persistArtifact(
        await makeTaskManifestArtifact(1, "standalone forbidden"),
        { expectedRevision: 0 },
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      readFile(
        standaloneStore.layout.task(FIXTURE_TASK_ID).taskManifest,
        "utf8",
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const event = (await loadReferenceEvents())[0]!;
    await expect(
      standaloneStore.appendTaskEvent(FIXTURE_TASK_ID, event),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      readFile(standaloneStore.layout.task(FIXTURE_TASK_ID).events, "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const bundleRoot = await createTemporaryWorktree();
    const bundleStore = await openFixtureStore(bundleRoot);
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;
    await expect(
      bundleStore.persistTaskBundle(
        {
          artifacts,
          events: bundle.events,
          idempotencyRecords: bundle.idempotencyRecords,
        },
        {
          expectedRevision: 0,
          idempotencyKey: control.idempotencyKey,
          requestDigest: control.requestDigest,
        },
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      readFile(
        bundleStore.layout.task(FIXTURE_TASK_ID).taskManifest,
        "utf8",
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("writes no Task or Event bytes when the ready Manifest has lost its Snapshot file", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const snapshot = await loadRepositorySnapshot();
    await store.persistArtifact(snapshot);
    await store.persistArtifact(await loadRepoPulse());
    await rename(
      store.layout.snapshot(snapshot.sourceSnapshotId),
      `${store.layout.snapshot(snapshot.sourceSnapshotId)}.missing`,
    );
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    const artifacts = await loadTaskArtifacts();
    const control = bundle.idempotencyRecords.at(-1)!;

    await expect(
      store.persistTaskBundle(
        {
          artifacts,
          events: bundle.events,
          idempotencyRecords: bundle.idempotencyRecords,
        },
        {
          expectedRevision: 0,
          idempotencyKey: control.idempotencyKey,
          requestDigest: control.requestDigest,
        },
      ),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      store.appendTaskEvent(FIXTURE_TASK_ID, bundle.events[0]!),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(
      readFile(store.layout.task(FIXTURE_TASK_ID).taskManifest),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(store.layout.task(FIXTURE_TASK_ID).events),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("publishes a contextless recovery transaction as partial on a cold repository", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const transaction = await loadContextlessTaskTransaction();

    const written = await store.persistTaskBundle(
      transaction.input,
      transaction.options,
    );
    expect(written).toMatchObject({
      replayed: false,
      bundle: { manifest: { revision: 1, status: "created" } },
    });
    const manifest = await store.readManifest();
    expect(manifest.status).toBe("cold");
    expect(manifest.latestSnapshotId).toBeUndefined();
    const taskDescriptors = manifest.artifacts.filter(
      (descriptor) => descriptor.taskId === FIXTURE_TASK_ID,
    );
    expect(taskDescriptors).toHaveLength(2);
    expect(
      taskDescriptors.map((descriptor) => [
        descriptor.artifactType,
        descriptor.freshness,
      ]),
    ).toEqual([
      ["task_manifest", "partial"],
      ["task_event_log", "partial"],
    ]);

    await expect(
      store.persistTaskBundle(transaction.input, transaction.options),
    ).resolves.toMatchObject({ replayed: true });
  });

  it.each(["claim-evidence", "finding", "verification"] as const)(
    "rejects a dangling %s reference before writing any Task bytes",
    async (failureMode) => {
      const root = await createTemporaryWorktree(
        `artifact-store-bundle-${failureMode}-`,
      );
      const store = await openFixtureStore(root);
      await store.persistArtifact(await loadRepositorySnapshot());
      const bundle = await loadContractFixture<TaskArtifactBundleV1>(
        "reference/task-bundle.json",
      );
      const artifacts = await loadTaskArtifacts();
      const artifactIndex =
        failureMode === "claim-evidence"
          ? artifacts.findIndex(
              (artifact) => artifact.artifactType === "claim_ledger",
            )
          : failureMode === "finding"
            ? artifacts.findIndex(
                (artifact) => artifact.artifactType === "change_check",
              )
            : artifacts.findIndex(
                (artifact) => artifact.artifactType === "verification",
              );
      const original = artifacts[artifactIndex]!;
      const payload = structuredClone(original.payload) as Record<
        string,
        unknown
      >;
      if (failureMode === "claim-evidence") {
        const claims = payload.claims as Array<{
          evidenceIds: string[];
        }>;
        claims[0]!.evidenceIds = ["evidence:missing"];
      } else if (failureMode === "finding") {
        const findings = payload.findings as Array<{
          claimIds: string[];
        }>;
        findings[0]!.claimIds.push("claim:missing-finding");
      } else {
        const records = payload.records as Array<{
          claimIds: string[];
        }>;
        records[0]!.claimIds.push("claim:missing-verification");
      }
      artifacts[artifactIndex] = {
        ...original,
        payload,
        contentDigest: sha256CanonicalJson(payload),
      } as PersistedArtifactV1;
      const control = bundle.idempotencyRecords.at(-1)!;
      await expect(
        store.persistTaskBundle(
          {
            artifacts,
            events: bundle.events,
            idempotencyRecords: bundle.idempotencyRecords,
          },
          {
            expectedRevision: 0,
            idempotencyKey: control.idempotencyKey,
            requestDigest: control.requestDigest,
          },
        ),
      ).rejects.toBeDefined();
      await expect(
        readFile(store.layout.task(FIXTURE_TASK_ID).taskManifest, "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("verifies the full event digest chain and all cross-ledger references", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const bundle = await loadContractFixture<TaskArtifactBundleV1>(
      "reference/task-bundle.json",
    );
    if (!("changeChecks" in bundle)) {
      throw new TypeError("The reference fixture must be a contextual bundle.");
    }
    expect(store.parseTrustedTaskBundle(bundle).manifest.status).toBe(
      "verified",
    );

    const digestTampered = structuredClone(bundle);
    digestTampered.events[0] = {
      ...digestTampered.events[0]!,
      eventDigest: sha256Bytes("not the event"),
    };
    expect(() => store.parseTrustedTaskBundle(digestTampered)).toThrow();

    const findingDangling = structuredClone(bundle);
    findingDangling.changeChecks[0]!.findings[0]!.claimIds.push(
      "claim:missing-finding",
    );
    expect(() => store.parseTrustedTaskBundle(findingDangling)).toThrow();

    const verificationDangling = structuredClone(bundle);
    verificationDangling.verificationRecords[0]!.claimIds.push(
      "claim:missing-verification",
    );
    expect(() => store.parseTrustedTaskBundle(verificationDangling)).toThrow();
  });
});
