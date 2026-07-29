import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  type PersistedArtifactV1,
  type RepoPulseArtifactV1,
  type RepositorySnapshotArtifactV1,
  type TaskEventV1,
  type TaskManifestArtifactV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  sha256CanonicalJson,
} from "../src/index.js";

export const FIXTURE_REPOSITORY_ID = "repository:fixture";
export const FIXTURE_WORKTREE_ID = "worktree:fixture";
export const FIXTURE_PRODUCER_VERSION = "3.0.0-alpha.1";
export const FIXTURE_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const temporaryRoots: string[] = [];

export async function createTemporaryWorktree(
  label = "artifact store 空格 中文-",
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), label));
  temporaryRoots.push(root);
  return root;
}

export async function cleanupTemporaryWorktrees(): Promise<void> {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    }),
  );
}

export async function openFixtureStore(root: string): Promise<ArtifactStore> {
  const store = await ArtifactStore.open(root, {
    repositoryId: FIXTURE_REPOSITORY_ID,
    worktreeId: FIXTURE_WORKTREE_ID,
    producerVersion: FIXTURE_PRODUCER_VERSION,
    lock: {
      timeoutMs: 500,
      staleAfterMs: 2_000,
      pollMinMs: 2,
      pollMaxMs: 5,
    },
  });
  await store.initialize();
  return store;
}

export async function loadContractFixture<T>(
  relativePath: string,
): Promise<T> {
  const fixtureUrl = new URL(
    `../../contracts/fixtures/v1/${relativePath}`,
    import.meta.url,
  );
  return JSON.parse(await readFile(fixtureUrl, "utf8")) as T;
}

export async function loadReferenceEvents(): Promise<TaskEventV1[]> {
  const fixtureUrl = new URL(
    "../../contracts/fixtures/v1/reference/events.jsonl",
    import.meta.url,
  );
  const text = await readFile(fixtureUrl, "utf8");
  return text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as TaskEventV1);
}

export async function loadRepositorySnapshot(): Promise<PersistedArtifactV1> {
  return loadContractFixture<PersistedArtifactV1>(
    "reference/repository-snapshot.json",
  );
}

export async function makeRepositorySnapshotArtifact(
  revision: number,
  label: string,
): Promise<RepositorySnapshotArtifactV1> {
  const fixture =
    await loadContractFixture<RepositorySnapshotArtifactV1>(
      "reference/repository-snapshot.json",
    );
  const createdAt =
    `2026-07-28T07:${String(revision).padStart(2, "0")}:00Z`;
  const payload = {
    ...fixture.payload,
    createdAt,
    limitations: [label],
  };
  return RepositorySnapshotArtifactV1Schema.parse({
    ...fixture,
    revision,
    createdAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

export async function loadRepoPulse(): Promise<RepoPulseArtifactV1> {
  return loadContractFixture<RepoPulseArtifactV1>(
    "reference/repo-pulse.json",
  );
}

export async function makeRepoPulseArtifact(
  revision: number,
  label: string,
): Promise<RepoPulseArtifactV1> {
  const fixture = await loadRepoPulse();
  const evaluatedAt =
    `2026-07-28T09:${String(revision).padStart(2, "0")}:00Z`;
  const payload = {
    ...fixture.payload,
    repositoryState: {
      ...fixture.payload.repositoryState!,
      branch: `feature/${label.replace(/[^a-z0-9-]+/giu, "-")}`,
    },
    evaluatedAt,
  };
  return RepoPulseArtifactV1Schema.parse({
    ...fixture,
    revision,
    createdAt: evaluatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}

export async function makeTaskManifestArtifact(
  revision: number,
  title: string,
): Promise<TaskManifestArtifactV1> {
  const fixture = await loadContractFixture<TaskManifestArtifactV1>(
    "reference/task.json",
  );
  const {
    currentChangeCheckId: _currentChangeCheckId,
    currentChangeCheckRevision: _currentChangeCheckRevision,
    ...basePayload
  } = fixture.payload;
  const payload = {
    ...basePayload,
    title,
    status: "context_ready" as const,
    revision,
    updatedAt: `2026-07-28T08:${String(revision).padStart(2, "0")}:00Z`,
  };
  return TaskManifestArtifactV1Schema.parse({
    ...fixture,
    revision,
    createdAt: payload.updatedAt,
    contentDigest: sha256CanonicalJson(payload),
    payload,
  });
}
