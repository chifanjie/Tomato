import { afterEach, expect, it } from "vitest";
import { ArtifactStore, sha256CanonicalJson } from "@understand-code/artifact-store";
import { RepositorySnapshotArtifactV1Schema, RefreshIndexOutputV1Schema } from "@understand-code/contracts";
import { captureLocalRepositorySnapshot } from "../src/runtime/context.js";
import { localRefreshIndexV1 } from "../src/handlers/local-refresh-index.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

it("refreshes after a product upgrade without rewriting an immutable prior-version Snapshot", async () => {
  const root = await createGitRepository({ seedArtifacts: false });
  const { snapshot } = await captureLocalRepositorySnapshot(root);
  const store = await ArtifactStore.open(root, { repositoryId: snapshot.repositoryId, worktreeId: snapshot.worktreeId, producerVersion: "0.0.9" });
  await store.initialize();
  const artifact = RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1, artifactType: "repository_snapshot", artifactId: `artifact:repository-snapshot:${snapshot.snapshotId}`,
    repositoryId: snapshot.repositoryId, worktreeId: snapshot.worktreeId, sourceSnapshotId: snapshot.snapshotId,
    producerVersion: "0.0.9", revision: 0, createdAt: snapshot.createdAt, contentDigest: sha256CanonicalJson(snapshot), payload: snapshot,
  });
  await store.persistArtifact(artifact);
  const refreshed = RefreshIndexOutputV1Schema.parse(await localRefreshIndexV1({ mode: "full", actor: "upgrade-test", idempotencyKey: "upgrade-refresh" }, root));
  expect(refreshed.structuredContent.result.operation.status).toBe("completed");
  expect((await store.readArtifact("repository_snapshot", { snapshotId: snapshot.snapshotId })).artifact).toEqual(artifact);
});
