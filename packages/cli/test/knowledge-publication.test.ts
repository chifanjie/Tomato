import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ committed: vi.fn(), pending: vi.fn(), promote: vi.fn() }));
vi.mock("@understand-code/artifact-store/committed-strong-task-projection-reader-internal", () => ({
  readCommittedStrongTaskProjectionInternalV1: mocks.committed,
}));
vi.mock("../src/runtime/repository-indexer.js", () => ({
  readPendingRepositoryIndexV1: mocks.pending,
  withRepositoryIndexKnowledgeLineageV1: mocks.promote,
}));
import { prepareTaskKnowledgeV1 } from "../src/handlers/knowledge-publication.js";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const snapshotId = `snapshot-${"1".repeat(64)}`;
const generationId = `generation-${"2".repeat(64)}`;
const predecessorGenerationId = `generation-${"3".repeat(64)}`;
const publishedId = `generation-${"4".repeat(64)}`;
const digest = `sha256:${"5".repeat(64)}` as const;
function fixture() {
  const bundle = {
    impactConclusion: {},
    manifest: { taskId, taskProfile: "agent_task_v1", revision: 7, status: "verified",
      latestSnapshotId: snapshotId, repositoryId: "repo", worktreeId: "worktree", currentChangeCheckId: "check:1" },
    changeChecks: [{ id: "check:1", actualSnapshotId: snapshotId }],
    verificationRecords: [{ id: "verification:1", snapshotId }],
  };
  const candidate = {
    generation: { generationId, generationManifestDigest: digest, sourceInventoryDigest: digest },
    publication: { manifestBytes: Buffer.from("{}"), files: [] },
    knowledgeLineage: { schemaVersion: 1, status: "pending", taskId, taskRevision: 4,
      sourceSnapshotId: snapshotId, predecessorGenerationId, requestDigest: digest, idempotencyKeyDigest: digest },
  };
  const readTaskBundle = vi.fn(async () => ({ bundle }));
  const inspectBusinessHead = vi.fn(async () => ({ revision: 9 }));
  mocks.committed.mockResolvedValue({ bundle });
  mocks.pending.mockResolvedValue(candidate);
  mocks.promote.mockImplementation((input) => ({ ...input, generation: { ...input.generation, generationId: publishedId } }));
  const input = {
    knowledge: { action: "publish", taskId, expectedTaskRevision: 7, candidateGenerationId: generationId },
    store: { readTaskBundle },
    provider: { inspectBusinessHead, inspectIndexPublicationAuthority: vi.fn(async () => ({ generationId: predecessorGenerationId })) },
    canonicalRoot: "/repo", snapshot: { snapshotId, repositoryId: "repo", worktreeId: "worktree" },
    sourceInventoryDigest: digest, requestDigest: digest, idempotencyKeyDigest: digest,
    observedProviderRevision: 9,
  } as unknown as Parameters<typeof prepareTaskKnowledgeV1>[0];
  return { input, bundle, candidate, readTaskBundle, inspectBusinessHead };
}
beforeEach(() => vi.resetAllMocks());
describe("Task knowledge publication authority", () => {
  it("labels unverified staging without claiming Provider-verified status", async () => {
    const f = fixture(); f.bundle.manifest.status = "verification_required";
    const result = await prepareTaskKnowledgeV1({ ...f.input,
      knowledge: { action: "stage", taskId, expectedTaskRevision: 7 },
    });
    expect(result).toMatchObject({ action: "stage", knowledgeLineage: { status: "pending", taskId, taskRevision: 7 } });
    expect(mocks.committed).not.toHaveBeenCalled();
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it("publishes only from the exact Provider-committed verified Task, not the local bundle", async () => {
    const f = fixture();
    await expect(prepareTaskKnowledgeV1(f.input)).resolves.toMatchObject({
      action: "publish", knowledgeLineage: { status: "published", taskRevision: 7,
        currentCheckId: "check:1", candidateGenerationId: generationId, verificationIds: ["verification:1"] },
    });
    expect(mocks.committed).toHaveBeenCalledWith(f.input.provider, { taskId, operation: "update_task", committedRevision: 7 });
    expect(f.readTaskBundle).not.toHaveBeenCalled();
  });
  it.each(["verification_required", "in_progress", "superseded"])("rejects %s as publication authority", async (status) => {
    const f = fixture(); f.bundle.manifest.status = status;
    await expect(prepareTaskKnowledgeV1(f.input)).rejects.toThrow();
    expect(mocks.promote).not.toHaveBeenCalled();
  });
  it("never falls back to a local verified Task when Provider verification fails", async () => {
    const f = fixture(); mocks.committed.mockRejectedValue(new Error("invalid Provider projection"));
    await expect(prepareTaskKnowledgeV1(f.input)).rejects.toThrow("invalid Provider projection");
    expect(f.readTaskBundle).not.toHaveBeenCalled();
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it.each(["task", "snapshot", "revision", "inventory", "predecessor"])("rejects candidate %s drift", async (kind) => {
    const f = fixture();
    if (kind === "task") f.candidate.knowledgeLineage.taskId = "other-task";
    if (kind === "snapshot") f.candidate.knowledgeLineage.sourceSnapshotId = "other-snapshot";
    if (kind === "revision") f.candidate.knowledgeLineage.taskRevision = 8;
    if (kind === "inventory") f.candidate.generation.sourceInventoryDigest = `sha256:${"6".repeat(64)}`;
    if (kind === "predecessor") f.candidate.knowledgeLineage.predecessorGenerationId = publishedId;
    await expect(prepareTaskKnowledgeV1(f.input)).rejects.toThrow();
    expect(mocks.promote).not.toHaveBeenCalled();
  });
  it("rejects an authority head changed after verified-Task inspection", async () => {
    const f = fixture(); f.inspectBusinessHead.mockResolvedValue({ revision: 10 });
    await expect(prepareTaskKnowledgeV1(f.input)).rejects.toThrow();
  });
  it("only reconstructs a committed replay when the publication generation is exact", async () => {
    const f = fixture();
    await expect(prepareTaskKnowledgeV1({ ...f.input, recoveredGenerationId: publishedId })).resolves.toMatchObject({ action: "publish" });
    expect(mocks.committed).not.toHaveBeenCalled();
    await expect(prepareTaskKnowledgeV1({ ...f.input, recoveredGenerationId: generationId })).rejects.toThrow();
  });
});
