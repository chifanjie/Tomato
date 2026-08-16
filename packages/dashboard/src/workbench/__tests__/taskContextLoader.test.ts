import { describe, expect, it, vi } from "vitest";
import { loadTaskWorkbench } from "../taskContextLoader";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const task = {
  schemaVersion: 1,
  taskId,
  title: "Preserve evidence across Agent handoffs",
  originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
  status: "verified",
  repositoryId: "repository:fixture",
  worktreeId: "worktree:fixture",
  baselineSnapshotId: "snapshot:baseline",
  latestSnapshotId: "snapshot:actual",
  currentChangeCheckId: "change-check:final",
  currentChangeCheckRevision: 9,
  createdAt: "2026-07-28T08:00:00Z",
  updatedAt: "2026-07-28T08:12:00Z",
  producerVersion: "3.0.0-alpha.1",
  revision: 12,
};

const brief = {
  originalIntent: task.originalIntent,
  goalClaimId: "claim:goal",
  nonGoalClaimIds: [],
  acceptanceClaimIds: ["claim:acceptance"],
  readingPath: [],
  plannedChanges: [],
  assumptionClaimIds: [],
  riskClaimIds: [],
  unknownClaimIds: [],
  verificationPlan: [{
    id: "verification-plan:contracts",
    acceptanceClaimIds: ["claim:acceptance"],
    method: "test",
    description: "Run the shared contract suite.",
    required: true,
  }],
};

const route = { view: "tasks" as const, taskId, section: "summary" };

describe("loadTaskWorkbench", () => {
  it("loads and validates a persisted Task Brief projection", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      task,
      brief,
      section: "summary",
      items: [{
        kind: "summary",
        originalIntent: task.originalIntent,
        goalClaimId: "claim:goal",
        acceptanceClaimCount: 1,
        plannedChangeCount: 0,
      }],
      pulse: null,
      freshness: { sourceSnapshotId: "snapshot:actual", current: true },
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

    const result = await loadTaskWorkbench(route, "token", fetcher);

    expect(result.status).toBe("ready");
    expect(result.payload?.task.taskId).toBe(taskId);
    expect(result.payload?.items).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/tasks/${taskId}/brief.json`),
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("surfaces a missing persisted Task as unavailable", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "task_brief_not_available" }), { status: 404 })) as unknown as typeof fetch;

    const result = await loadTaskWorkbench(route, "token", fetcher);

    expect(result.status).toBe("missing");
    expect(result.message).toContain("No persisted Task Brief");
  });
});
