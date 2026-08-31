import { type ArtifactStore } from "@understand-code/artifact-store";
import { readCommittedStrongTaskProjectionInternalV1 } from "@understand-code/artifact-store/committed-strong-task-projection-reader-internal";
import {
  type RefreshIndexInputV1Schema,
  type StrongRepositorySnapshotV1,
  type TaskArtifactBundleV1,
} from "@understand-code/contracts";
import { type ProviderProductionStrongObjectClientV1 } from "@understand-code/durable-object-provider-client";

import { ToolFailure, artifactUnavailableFailure } from "../errors/tool-errors.js";
import {
  readPendingRepositoryIndexV1,
  withRepositoryIndexKnowledgeLineageV1,
  type RepositoryIndexKnowledgeLineageV1,
} from "../runtime/repository-indexer.js";

type KnowledgeInput = NonNullable<ReturnType<typeof RefreshIndexInputV1Schema.parse>["knowledge"]>;
type Digest = `sha256:${string}`;

function unavailable(): never {
  throw new ToolFailure(artifactUnavailableFailure("stale", "task_knowledge"));
}

/** Pending is not authority. Publication requires a Provider-committed verified Task. */
export async function prepareTaskKnowledgeV1(input: Readonly<{
  knowledge: KnowledgeInput;
  store: ArtifactStore;
  provider: ProviderProductionStrongObjectClientV1;
  canonicalRoot: string;
  snapshot: StrongRepositorySnapshotV1;
  sourceInventoryDigest: Digest;
  requestDigest: Digest;
  idempotencyKeyDigest: Digest;
  observedProviderRevision: number;
  /** Only an exact, already authenticated refresh request may reconstruct a replay. */
  recoveredGenerationId?: string;
}>) {
  const { knowledge, snapshot } = input;
  const recovered = input.recoveredGenerationId !== undefined;
  let bundle: TaskArtifactBundleV1;
  if (knowledge.action === "stage" || recovered) {
    // A local bundle can label an unverified candidate, or reconstruct bytes
    // subsequently matched against an already committed generation digest.
    bundle = (await input.store.readTaskBundle(knowledge.taskId)).bundle;
  } else {
    bundle = (await readCommittedStrongTaskProjectionInternalV1(input.provider, {
      taskId: knowledge.taskId,
      operation: "update_task",
      committedRevision: knowledge.expectedTaskRevision,
    })).bundle;
  }
  const task = bundle.manifest;
  if (task.taskId !== knowledge.taskId || task.revision !== knowledge.expectedTaskRevision ||
    task.taskProfile !== "agent_task_v1" || task.latestSnapshotId !== snapshot.snapshotId ||
    task.repositoryId !== snapshot.repositoryId || task.worktreeId !== snapshot.worktreeId) unavailable();
  const predecessor = await input.provider.inspectIndexPublicationAuthority();
  if (knowledge.action === "stage") {
    if (task.status === "verified" || task.status === "superseded") unavailable();
    const knowledgeLineage: RepositoryIndexKnowledgeLineageV1 = {
      schemaVersion: 1, status: "pending", taskId: task.taskId,
      taskRevision: task.revision, sourceSnapshotId: snapshot.snapshotId,
      requestDigest: input.requestDigest, idempotencyKeyDigest: input.idempotencyKeyDigest,
      ...(predecessor === undefined ? {} : { predecessorGenerationId: predecessor.generationId }),
    };
    return { action: "stage" as const, knowledgeLineage };
  }
  if (!("impactConclusion" in bundle)) unavailable();
  if (task.status !== "verified" || task.currentChangeCheckId === undefined ||
    !bundle.changeChecks.some((check) => check.id === task.currentChangeCheckId &&
      check.actualSnapshotId === snapshot.snapshotId)) unavailable();
  const candidate = await readPendingRepositoryIndexV1({
    canonicalRoot: input.canonicalRoot, generationId: knowledge.candidateGenerationId,
  });
  const origin = candidate.knowledgeLineage;
  if (origin.status !== "pending" || origin.taskId !== task.taskId ||
    origin.taskRevision >= task.revision || origin.sourceSnapshotId !== snapshot.snapshotId ||
    candidate.generation.sourceInventoryDigest !== input.sourceInventoryDigest ||
    (!recovered && origin.predecessorGenerationId !== predecessor?.generationId)) unavailable();
  const publication = withRepositoryIndexKnowledgeLineageV1({
    ...candidate,
    knowledgeLineage: {
      ...origin, status: "published", taskRevision: task.revision,
      candidateGenerationId: candidate.generation.generationId,
      currentCheckId: task.currentChangeCheckId,
      verificationIds: bundle.verificationRecords
        .filter((record) => record.snapshotId === snapshot.snapshotId)
        .map((record) => record.id).sort(),
    },
  });
  if (recovered && publication.generation.generationId !== input.recoveredGenerationId) unavailable();
  // Bind the subsequent refresh prepare to the same business-head observation.
  // It must never rebase over another Task transition or knowledge publisher.
  const head = await input.provider.inspectBusinessHead();
  if (!recovered && head.revision !== input.observedProviderRevision) unavailable();
  return { action: "publish" as const, ...publication, candidate };
}
