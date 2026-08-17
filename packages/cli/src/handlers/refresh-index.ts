import { performance } from "node:perf_hooks";

import {
  ArtifactStore,
  ArtifactStoreError,
  sha256CanonicalJson,
} from "@understand-code/artifact-store";
import {
  RefreshIndexInputV1Schema,
  RefreshIndexOutputV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  type RepoPulseStatusV1,
} from "@understand-code/contracts";
import {
  buildRepoPulse,
  inspectArtifactFreshness,
} from "@understand-code/repository-state";

import { PRODUCT_VERSION } from "../constants.js";
import {
  ToolFailure,
  artifactUnavailableFailure,
  invalidArgumentsFailure,
  repositoryNotReadyFailure,
  sourceAccessDeniedFailure,
} from "../errors/tool-errors.js";
import {
  captureBoundRepositorySnapshot,
  fingerprintPublishedSnapshot,
} from "../runtime/context.js";
import {
  RepositoryIndexError,
  buildRepositoryIndex,
} from "../runtime/repository-indexer.js";

/**
 * Captures and publishes repository facts. Incremental mode re-evaluates the
 * currently published artifact set; full mode first runs the bundled local
 * source indexer and then publishes a Pulse over the generated Graph/Wiki set.
 */
export async function refreshIndex(
  argumentsValue: unknown,
  canonicalRoot: string,
): Promise<unknown> {
  const parsed = RefreshIndexInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) {
    throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  }

  const startedAt = performance.now();
  const startedIso = new Date().toISOString();
  const capture = await captureBoundRepositorySnapshot(canonicalRoot);
  if (capture.canonicalRoot !== canonicalRoot) {
    throw new ToolFailure(
      repositoryNotReadyFailure(
        "unknown",
        ["repository_snapshot"],
        "repair_environment",
      ),
    );
  }
  if (capture.snapshot.captureStatus === "error") {
    throw new ToolFailure(
      repositoryNotReadyFailure(
        "unknown",
        ["repository_snapshot"],
        "repair_environment",
      ),
    );
  }
  const store = await ArtifactStore.open(canonicalRoot, {
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    producerVersion: PRODUCT_VERSION,
  });
  let previousManifest;
  try {
    previousManifest = await store.readManifest({ verifyArtifacts: false });
  } catch (error) {
    if (
      !(
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      )
    ) {
      throw error;
    }
    // A stale optimistic pin must not bootstrap a new managed store as a
    // side-effect of a failed refresh.
    if (parsed.data.expectedSourceSnapshotId !== undefined) {
      throw new ToolFailure(
        artifactUnavailableFailure("stale", "repository_snapshot"),
      );
    }
    previousManifest = await store.initialize();
  }
  // OperationControl is an optimistic pin on the *published* source.  The
  // capture may legitimately produce a new Snapshot because the worktree
  // changed since that source was published.
  if (
    parsed.data.expectedSourceSnapshotId !== undefined &&
    parsed.data.expectedSourceSnapshotId !== previousManifest.latestSnapshotId
  ) {
    throw new ToolFailure(
      artifactUnavailableFailure("stale", "repository_snapshot"),
    );
  }
  if (parsed.data.mode === "full") {
    try {
      await buildRepositoryIndex({
        canonicalRoot,
        snapshot: capture.snapshot,
      });
    } catch (error) {
      if (error instanceof RepositoryIndexError) {
        if (/symbolic link|symlink|escapes bound root|unsafe/u.test(error.message)) {
          throw new ToolFailure(sourceAccessDeniedFailure("symlink_escape"));
        }
        throw new ToolFailure(
          repositoryNotReadyFailure(
            "error",
            ["knowledge_graph", "wiki_index"],
            "repair_environment",
          ),
        );
      }
      throw error;
    }
  }
  const snapshotArtifact = RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: PRODUCT_VERSION,
    createdAt: capture.snapshot.createdAt,
    contentDigest: sha256CanonicalJson(capture.snapshot),
    payload: capture.snapshot,
  });
  let snapshotReplayed = false;
  let snapshotCreatedAt = capture.snapshot.createdAt;
  try {
    // Snapshot IDs are content-stable and captures may differ only in their
    // wall-clock `createdAt`; reuse already-published immutable bytes instead
    // of attempting to replace the identity in place.
    const existingSnapshot = await store.readArtifact("repository_snapshot", {
      snapshotId: capture.snapshot.snapshotId,
    });
    if (existingSnapshot.artifact.artifactType !== "repository_snapshot") {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Repository Snapshot path resolved another Artifact type.",
      );
    }
    snapshotCreatedAt = existingSnapshot.artifact.payload.createdAt;
    snapshotReplayed = true;
  } catch (error) {
    if (
      !(
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      )
    ) {
      throw error;
    }
    const publication = await store.persistArtifact(snapshotArtifact);
    snapshotReplayed = publication.replayed;
  }

  const currentPulse = await readCurrentPulse(store);
  const freshness = await inspectArtifactFreshness(
    canonicalRoot,
    capture.snapshot,
    { manifest: previousManifest },
  );
  const pulse = buildRepoPulse({
    snapshot: capture.snapshot,
    git: capture.git,
    artifacts: freshness,
    evaluatedAt: snapshotCreatedAt,
    ...(previousManifest.latestSnapshotId !== undefined &&
    previousManifest.latestSnapshotId !== capture.snapshot.snapshotId
      ? { baselineSnapshotId: previousManifest.latestSnapshotId }
      : currentPulse?.artifact.artifactType === "repo_pulse" &&
          currentPulse.artifact.payload.baselineSnapshotId !== undefined
        ? { baselineSnapshotId: currentPulse.artifact.payload.baselineSnapshotId }
        : {}),
  });
  const pulseDigest = sha256CanonicalJson(pulse);
  const samePublishedPulse =
    currentPulse !== undefined &&
    currentPulse.artifact.sourceSnapshotId === capture.snapshot.snapshotId &&
    currentPulse.artifact.contentDigest === pulseDigest;
  const pulseRevision =
    currentPulse === undefined || samePublishedPulse
      ? currentPulse?.artifact.revision ?? 0
      : currentPulse.artifact.revision + 1;
  const requestDigest = sha256CanonicalJson({
    operation: "refresh_index",
    mode: parsed.data.mode,
    expectedSourceSnapshotId: parsed.data.expectedSourceSnapshotId ?? null,
    actor: parsed.data.actor,
  });
  const pulseArtifact = RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    // ArtifactStore versions a colliding canonical pulse identity while
    // retaining immutable history.  A stable base identity also makes a
    // same-request replay deterministic.
    artifactId: "artifact:repo-pulse",
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: pulseRevision,
    producerVersion: PRODUCT_VERSION,
    createdAt: pulse.evaluatedAt,
    contentDigest: pulseDigest,
    payload: pulse,
  });
  const pulsePublication = await store.persistArtifact(pulseArtifact, {
    ...(currentPulse === undefined ? {} : { expectedRevision: currentPulse.artifact.revision }),
    idempotencyKey: parsed.data.idempotencyKey,
    requestDigest,
  });

  const completedIso = new Date().toISOString();
  const operationId = `operation:refresh:${capture.snapshot.snapshotId}:${requestDigest.slice(-16)}`;
  const previousSnapshotId = previousManifest.latestSnapshotId;
  const operation = {
    operationId,
    mode: parsed.data.mode,
    status: "completed" as const,
    ...(previousSnapshotId === undefined || previousSnapshotId === capture.snapshot.snapshotId
      ? {}
      : { sourceSnapshotId: previousSnapshotId }),
    finalSnapshotId: capture.snapshot.snapshotId,
    startedAt: startedIso,
    completedAt: completedIso,
    previousSnapshotPreservedUntilCommit: true as const,
    cancellation: {
      mechanism: "mcp_request_cancellation" as const,
      notificationMethod: "notifications/cancelled" as const,
      effect: "cooperative_stop_preserve_last_snapshot" as const,
    },
  };
  const freshnessStatus = pulsePublication.artifact.payload.status as RepoPulseStatusV1;
  return RefreshIndexOutputV1Schema.parse({
    isError: false,
    content: [{
      type: "text",
      text: freshnessStatus === "not_ready"
        ? "Repository snapshot published; downstream indexes remain unavailable."
        : "Repository snapshot and pulse published.",
    }],
    structuredContent: {
      schemaVersion: 1,
      meta: {
        repositoryId: capture.snapshot.repositoryId,
        worktreeId: capture.snapshot.worktreeId,
        sourceSnapshotId: capture.snapshot.snapshotId,
        headCommit: capture.snapshot.headCommit ?? null,
        worktreeFingerprint: fingerprintPublishedSnapshot(capture.snapshot),
        freshness: freshnessStatus,
        durationMs: Math.max(0, performance.now() - startedAt),
        cacheHit: snapshotReplayed && pulsePublication.replayed,
        truncated: false,
        truncatedCategories: [],
      },
      result: { operation },
    },
  });
}

async function readCurrentPulse(
  store: ArtifactStore,
): Promise<Awaited<ReturnType<ArtifactStore["readArtifact"]>> | undefined> {
  try {
    return await store.readArtifact("repo_pulse");
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "artifact_not_found"
    ) {
      return undefined;
    }
    throw error;
  }
}
