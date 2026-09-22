import { readLocalRefreshReceiptV1, writeLocalRefreshReceiptV1 } from "./local-refresh-receipt.js";
import { createHash } from "node:crypto";
import path from "node:path";
import { ArtifactStore, sha256CanonicalJson } from "@understand-code/artifact-store";
import { RefreshIndexOutputV1Schema, RepoPulseArtifactV1Schema, RepositorySnapshotV1Schema, type RefreshIndexInputV1 } from "@understand-code/contracts";
import { PRODUCT_VERSION } from "../constants.js";
import { operationCheckpoint } from "../runtime/operation-control.js";
import { captureLocalRepositorySnapshot, fingerprintPublishedSnapshot } from "../runtime/context.js";
import { ToolFailure, invalidArgumentFailure, artifactUnavailableFailure } from "../errors/tool-errors.js";
import {
  assertRepositoryKnowledgeWriterReadyV1, buildRepositoryIndex, discardStagedRepositoryIndex,
  openActiveRepositoryIndexV1, preflightRepositoryIndex, publishStagedRepositoryIndex,
  readPendingRepositoryIndexV1, savePendingRepositoryIndexV1, withRepositoryIndexKnowledgeLineageV1,
  withRepositoryIndexWriterDraftV1,
  archivePublishedRepositoryIndexV1,
} from "../runtime/repository-indexer.js";

export async function localKnowledgeRefreshIndexV1(input: RefreshIndexInputV1, canonicalRoot: string): Promise<unknown> {
  const knowledge = input.knowledge!;
  const startedAt = new Date().toISOString();
  const capture = await captureLocalRepositorySnapshot(canonicalRoot);
  const store = await ArtifactStore.open(canonicalRoot, { repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId, producerVersion: PRODUCT_VERSION });
  await store.initialize();
  return store.withLocalPublication(async () => {
      const replay = await readLocalRefreshReceiptV1(canonicalRoot, input);
      if (replay !== undefined) {
        const completed = RefreshIndexOutputV1Schema.parse(replay).structuredContent.result.knowledge;
        if (completed && knowledge.action === "stage") {
          // A discarded candidate must not reappear as a successful stage receipt.
          await readPendingRepositoryIndexV1({ canonicalRoot, generationId: completed.candidateGenerationId });
        }
        if (completed && knowledge.action === "publish") {
          await archivePublishedRepositoryIndexV1({ canonicalRoot, taskId: knowledge.taskId, generationId: completed.candidateGenerationId });
        }
        return replay;
      }
      const active = await openActiveRepositoryIndexV1(canonicalRoot);
      const bundle = (await store.readTaskBundle(knowledge.taskId)).bundle;
      const task = bundle.manifest;
      const unavailable = (): never => { throw new ToolFailure(artifactUnavailableFailure("stale", "task_knowledge")); };
      if (active.authority.runtimeProfile !== "local_durable_v1" || task.taskProfile !== undefined ||
        task.revision !== knowledge.expectedTaskRevision || task.latestSnapshotId !== input.expectedSourceSnapshotId ||
        task.latestSnapshotId !== capture.snapshot.snapshotId || active.authority.sourceSnapshotId !== task.latestSnapshotId ||
        task.repositoryId !== store.repositoryId || task.worktreeId !== store.worktreeId || task.status === "superseded") unavailable();
      const snapshotArtifact = await store.readArtifact("repository_snapshot", { snapshotId: task.latestSnapshotId });
      if (snapshotArtifact.artifact.artifactType !== "repository_snapshot" || "profile" in snapshotArtifact.artifact.payload) unavailable();
      const snapshot = RepositorySnapshotV1Schema.parse(snapshotArtifact.artifact.payload);
      const preflight = await preflightRepositoryIndex(canonicalRoot);
      await operationCheckpoint("Knowledge sources checked");
      if (preflight.sourceInventoryDigest !== active.generation.sourceInventoryDigest) unavailable();
      const requestDigest = sha256CanonicalJson(input) as `sha256:${string}`;
      const idempotencyKeyDigest = `sha256:${createHash("sha256").update(input.idempotencyKey).digest("hex")}` as const;
      const operationId = requestDigest.slice(7, 39);
      const scope = { canonicalRoot, canonicalInstallationRoot: path.join(canonicalRoot, ".understand-code"), operationId };
      let generationId: string;
      let candidateGenerationId: string;
      if (knowledge.action === "stage") {
        // Reclaim the slot of a publication made before automatic archival was
        // introduced. The immutable archived candidate remains readable.
        if (active.knowledgeLineage?.status === "published" && active.knowledgeLineage.candidateGenerationId) {
          await archivePublishedRepositoryIndexV1({ canonicalRoot, taskId: active.knowledgeLineage.taskId, generationId: active.knowledgeLineage.candidateGenerationId });
        }
        const built = await buildRepositoryIndex({ ...scope, snapshot, expectedSourceInventoryDigest: preflight.sourceInventoryDigest });
        try {
          const writer = await withRepositoryIndexWriterDraftV1({ canonicalRoot, taskId: task.taskId, index: built });
          await operationCheckpoint("Writer draft validated");
          const candidate = withRepositoryIndexKnowledgeLineageV1({ ...writer, knowledgeLineage: {
            schemaVersion: 1, status: "pending", taskId: task.taskId, taskRevision: task.revision,
            sourceSnapshotId: task.latestSnapshotId, requestDigest, idempotencyKeyDigest,
            predecessorGenerationId: active.generation.generationId,
          } });
          const after = await captureLocalRepositorySnapshot(canonicalRoot);
          if (after.snapshot.snapshotId !== snapshot.snapshotId) unavailable();
          await operationCheckpoint("Saving knowledge candidate");
          await savePendingRepositoryIndexV1({ canonicalRoot, ...candidate });
          generationId = candidateGenerationId = candidate.generation.generationId;
        } finally { await discardStagedRepositoryIndex(scope); }
      } else {
        if (task.status !== "verified" || !task.currentChangeCheckId || !("verificationRecords" in bundle) ||
          !bundle.changeChecks.some((check) => check.id === task.currentChangeCheckId && check.actualSnapshotId === task.latestSnapshotId)) {
          throw new ToolFailure(invalidArgumentFailure(["knowledge"], "verified_task_and_current_check_required"));
        }
        const candidate = await readPendingRepositoryIndexV1({ canonicalRoot, generationId: knowledge.candidateGenerationId });
        const origin = candidate.knowledgeLineage;
        const alreadyPublished = active.knowledgeLineage?.status === "published" &&
          active.knowledgeLineage.candidateGenerationId === candidate.generation.generationId &&
          active.knowledgeLineage.taskId === task.taskId && active.knowledgeLineage.taskRevision === task.revision &&
          active.knowledgeLineage.sourceSnapshotId === task.latestSnapshotId;
        if (origin.taskId !== task.taskId || origin.taskRevision > task.revision || origin.sourceSnapshotId !== task.latestSnapshotId ||
          (!alreadyPublished && origin.predecessorGenerationId !== active.generation.generationId) || candidate.generation.sourceInventoryDigest !== preflight.sourceInventoryDigest) unavailable();
        assertRepositoryKnowledgeWriterReadyV1(candidate);
        if (alreadyPublished) {
          generationId = active.generation.generationId;
          candidateGenerationId = candidate.generation.generationId;
        } else {
          const published = withRepositoryIndexKnowledgeLineageV1({ ...candidate, knowledgeLineage: {
            ...origin, status: "published", taskRevision: task.revision,
            candidateGenerationId: candidate.generation.generationId, currentCheckId: task.currentChangeCheckId,
            verificationIds: bundle.verificationRecords.filter((record) => record.snapshotId === task.latestSnapshotId).map((record) => record.id).sort(),
          } });
          const pulseRead = await store.readArtifact("repo_pulse");
          if (pulseRead.artifact.artifactType !== "repo_pulse") unavailable();
          const payload = { ...pulseRead.artifact.payload, evaluatedAt: new Date().toISOString() };
          const pulse = RepoPulseArtifactV1Schema.parse({ ...pulseRead.artifact, revision: pulseRead.artifact.revision + 1,
            createdAt: payload.evaluatedAt, contentDigest: sha256CanonicalJson(payload), payload });
          const after = await captureLocalRepositorySnapshot(canonicalRoot);
          if (after.snapshot.snapshotId !== snapshot.snapshotId) unavailable();
          await operationCheckpoint("Publishing verified knowledge");
          await publishStagedRepositoryIndex({ ...scope, ...published,
            authority: { runtimeProfile: "local_durable_v1", sourceSnapshotId: task.latestSnapshotId, finalizedProviderRevision: pulse.revision + 1 },
            publishStoreCut: async () => { await store.persistArtifact(pulse, { expectedRevision: pulseRead.artifact.revision }); },
          });
          generationId = published.generation.generationId;
          candidateGenerationId = candidate.generation.generationId;
        }
        await archivePublishedRepositoryIndexV1({ canonicalRoot, taskId: task.taskId, generationId: candidateGenerationId });
      }
      const result = RefreshIndexOutputV1Schema.parse({ isError: false, content: [{ type: "text", text: knowledge.action === "stage"
        ? `Task knowledge candidate persisted for review. To prepare source-verified writer content, run understand-code knowledge --root "$PWD" --task-id ${task.taskId} --guide in this repository. The packaged writer workflow prepares drafts, supplies file/topic writer instructions, validates and finalizes them. Then stage again with a new idempotency key. Diagnostic candidates remain blocked for formal publication.`
        : "Verified Task knowledge published with source-bound writer evidence." }], structuredContent: { schemaVersion: 1,
        meta: { repositoryId: store.repositoryId, worktreeId: store.worktreeId, sourceSnapshotId: snapshot.snapshotId,
          headCommit: snapshot.headCommit ?? null, worktreeFingerprint: fingerprintPublishedSnapshot(snapshot), freshness: "fresh",
          durationMs: Date.now() - Date.parse(startedAt), cacheHit: false, truncated: false, truncatedCategories: [] },
        result: { operation: { operationId, mode: "full", status: "completed", sourceSnapshotId: snapshot.snapshotId,
          finalSnapshotId: snapshot.snapshotId, startedAt, completedAt: new Date().toISOString(), previousSnapshotPreservedUntilCommit: true,
          cancellation: { mechanism: "mcp_request_cancellation", notificationMethod: "notifications/cancelled", effect: "cooperative_stop_preserve_last_snapshot" } },
          knowledge: { status: knowledge.action === "stage" ? "pending" : "published", generationId, candidateGenerationId,
            taskId: task.taskId, taskRevision: task.revision, sourceSnapshotId: snapshot.snapshotId } } } });
      await writeLocalRefreshReceiptV1(canonicalRoot, input, result);
      return result;
    }, knowledge.taskId);
}
