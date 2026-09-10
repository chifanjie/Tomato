import { readLocalRefreshReceiptV1, writeLocalRefreshReceiptV1 } from "./local-refresh-receipt.js";
import { localKnowledgeRefreshIndexV1 } from "./local-knowledge-refresh.js";
import { createHash } from "node:crypto";
import path from "node:path";
import { ArtifactStore, ArtifactStoreError, sha256CanonicalJson } from "@understand-code/artifact-store";
import { RepoPulseArtifactV1Schema, RepositorySnapshotArtifactV1Schema, RefreshIndexOutputV1Schema, type RefreshIndexInputV1 } from "@understand-code/contracts";
import { buildRepoPulse } from "@understand-code/repository-state";
import { PRODUCT_VERSION } from "../constants.js";
import { captureLocalRepositorySnapshot, fingerprintPublishedSnapshot } from "../runtime/context.js";
import { buildRepositoryIndex, publishStagedRepositoryIndex, preflightRepositoryIndex } from "../runtime/repository-indexer.js";
import { ToolFailure, invalidArgumentFailure, repositoryNotReadyFailure } from "../errors/tool-errors.js";

/** Local single-user durability profile. Does not mint Provider authority or strong claims. */
export async function localRefreshIndexV1(input: RefreshIndexInputV1, canonicalRoot: string): Promise<unknown> {
  if (input.knowledge !== undefined) return localKnowledgeRefreshIndexV1(input, canonicalRoot);
  if (process.platform !== "darwin" && process.platform !== "linux") throw new ToolFailure(repositoryNotReadyFailure("unknown", ["local_runtime_platform"], "repair_environment"));
  const startedAt = new Date().toISOString();
  const capture = await captureLocalRepositorySnapshot(canonicalRoot);
  if (capture.snapshot.captureStatus === "error" || capture.canonicalRoot !== canonicalRoot) throw new ToolFailure(repositoryNotReadyFailure("unknown", ["repository_snapshot"], "repair_environment"));
  const store = await ArtifactStore.open(canonicalRoot, { repositoryId: capture.snapshot.repositoryId, worktreeId: capture.snapshot.worktreeId, producerVersion: PRODUCT_VERSION });
  // Serializes the Snapshot/Pulse/index publication cut across MCP processes;
  // individual Store writes retain their own CAS, fsync and digest checks.
  await store.initialize();
  return store.withLocalPublication(async () => {
    const replay = await readLocalRefreshReceiptV1(canonicalRoot, input);
    if (replay !== undefined) return replay;
    let manifest;
    try { manifest = await store.readManifest({ verifyArtifacts: false }); } catch (error) {
      if (!(error instanceof ArtifactStoreError) || error.code !== "artifact_not_found") throw error;
    }
    if (input.expectedSourceSnapshotId !== undefined && input.expectedSourceSnapshotId !== manifest?.latestSnapshotId) throw new ToolFailure(invalidArgumentFailure(["expectedSourceSnapshotId"], "snapshot_mismatch"));
    const snapshotAlreadyPublished = manifest?.artifacts.some((entry) => entry.artifactType === "repository_snapshot" && entry.sourceSnapshotId === capture.snapshot.snapshotId) === true;
    if (snapshotAlreadyPublished) {
      const existing = await store.readArtifact("repository_snapshot", { snapshotId: capture.snapshot.snapshotId });
      if (existing.artifact.artifactType !== "repository_snapshot" || "profile" in existing.artifact.payload) throw new Error("local snapshot profile mismatch");
      capture.snapshot = existing.artifact.payload;
    }
    const preflight = await preflightRepositoryIndex(canonicalRoot);
    const operationId = createHash("sha256").update(JSON.stringify([input, capture.snapshot.snapshotId])).digest("hex").slice(0, 32);
    const scope = { canonicalRoot, canonicalInstallationRoot: path.join(canonicalRoot, ".understand-code"), operationId };
    const built = await buildRepositoryIndex({ ...scope, snapshot: capture.snapshot, expectedSourceInventoryDigest: preflight.sourceInventoryDigest });
    const after = await captureLocalRepositorySnapshot(canonicalRoot);
    if (after.snapshot.snapshotId !== capture.snapshot.snapshotId) throw new ToolFailure(repositoryNotReadyFailure("stale", ["repository_changed_during_index"], "refresh_index"));
    // The manifest also retains historical Pulse descriptors; only the canonical
    // current Pulse can supply the next publication revision and CAS predecessor.
    const previous = manifest?.artifacts.some((entry) => entry.artifactType === "repo_pulse")
      ? (await store.readArtifact("repo_pulse")).artifact : undefined;
    if (previous !== undefined && previous.artifactType !== "repo_pulse") throw new Error("local Pulse profile mismatch");
    const revision = (previous?.revision ?? -1) + 1;
    const pulse = buildRepoPulse({ snapshot: capture.snapshot, git: capture.git, evaluatedAt: new Date().toISOString(), artifacts: { graph: "fresh", wiki: "fresh", evidence: "fresh", diff: "fresh", task: "fresh" }, completeness: { parser: { status: "partial", reasons: ["Static parser coverage is bounded by supported languages; inspect index coverage."] }, callGraph: { status: "partial", reasons: ["Static calls include unresolved relations; this is not a runtime trace."] } } });
    const common = { schemaVersion: 1, repositoryId: store.repositoryId, worktreeId: store.worktreeId, sourceSnapshotId: capture.snapshot.snapshotId, producerVersion: PRODUCT_VERSION };
    const snapshotArtifact = RepositorySnapshotArtifactV1Schema.parse({ ...common, artifactType: "repository_snapshot", artifactId: `artifact:repository-snapshot:${capture.snapshot.snapshotId}`, revision: 0, createdAt: capture.snapshot.createdAt, contentDigest: sha256CanonicalJson(capture.snapshot), payload: capture.snapshot });
    const pulseArtifact = RepoPulseArtifactV1Schema.parse({ ...common, artifactType: "repo_pulse", artifactId: `artifact:repo-pulse:${capture.snapshot.snapshotId}`, revision, createdAt: pulse.evaluatedAt, contentDigest: sha256CanonicalJson(pulse), payload: pulse });
    await publishStagedRepositoryIndex({ ...scope, ...built, authority: { sourceSnapshotId: capture.snapshot.snapshotId, finalizedProviderRevision: revision + 1, runtimeProfile: "local_durable_v1" }, publishStoreCut: async () => {
      // An upgrade may have a new producerVersion; an existing Snapshot's
      // validated envelope remains immutable across product versions.
      if (!snapshotAlreadyPublished) await store.persistArtifact(snapshotArtifact);
      await store.persistArtifact(pulseArtifact, previous === undefined ? {} : { expectedRevision: previous.revision });
    } });
    const result = RefreshIndexOutputV1Schema.parse({ isError: false, content: [{ type: "text", text: "Local index and repository snapshot persisted. Wiki is a diagnostic draft; the host must analyze source evidence before recording conclusions." }], structuredContent: { schemaVersion: 1, meta: { repositoryId: store.repositoryId, worktreeId: store.worktreeId, sourceSnapshotId: capture.snapshot.snapshotId, headCommit: capture.snapshot.headCommit ?? null, worktreeFingerprint: fingerprintPublishedSnapshot(capture.snapshot), freshness: pulse.status, durationMs: Date.now() - Date.parse(startedAt), cacheHit: false, truncated: false, truncatedCategories: [] }, result: { operation: { operationId, mode: input.mode, status: "completed", ...(manifest?.latestSnapshotId === undefined ? {} : { sourceSnapshotId: manifest.latestSnapshotId }), finalSnapshotId: capture.snapshot.snapshotId, startedAt, completedAt: new Date().toISOString(), previousSnapshotPreservedUntilCommit: true, cancellation: { mechanism: "mcp_request_cancellation", notificationMethod: "notifications/cancelled", effect: "cooperative_stop_preserve_last_snapshot" } } } } });
    await writeLocalRefreshReceiptV1(canonicalRoot, input, result);
    return result;
  });
}
