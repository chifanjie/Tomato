import { describe, expect, it, vi } from "vitest";
import type { RepoPulseSurfaceResponseV1 } from "@understand-code/contracts";
import {
  loadTaskKnowledgeCandidates,
  loadTaskWorkbench,
  parseTaskKnowledgeCandidates,
} from "../taskContextLoader";

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

const legacyPulse = {
  viewVersion: 1,
  viewKind: "legacy_repo_pulse_redacted",
  status: "partial",
  aggregateChangeCount: 4,
  evaluatedAt: "2026-08-23T12:00:00Z",
  strongOperationSupported: false,
} satisfies RepoPulseSurfaceResponseV1;

describe("loadTaskWorkbench", () => {
  it("loads a Task-bound Impact artifact and preserves its conclusion and provenance", async () => {
    const impactArtifact = {
      schemaVersion: 1,
      artifactType: "impact",
      artifactId: "impact-artifact:demo",
      taskId,
      repositoryId: task.repositoryId,
      worktreeId: task.worktreeId,
      sourceSnapshotId: task.latestSnapshotId,
      revision: task.revision,
      producerVersion: task.producerVersion,
      createdAt: task.updatedAt,
      contentDigest: `sha256:${"b".repeat(64)}`,
      payload: {
        paths: [{
          id: "impact:demo",
          sourceNodeId: "function:src/index.ts:entry",
          targetNodeId: "function:src/index.ts:consumer",
          classification: "observed",
          claimIds: ["claim:acceptance"],
          steps: [{
            source: "function:src/index.ts:entry",
            edgeType: "calls",
            target: "function:src/index.ts:consumer",
            direction: "downstream",
            evidenceId: "evidence:source",
            provenance: [{ filePath: "src/index.ts", lineNumber: 2, confidence: "exact", source: "static-analysis" }],
          }],
        }],
        conclusion: { status: "paths_observed", impactPathIds: ["impact:demo"], boundaryEvidenceIds: [] },
      },
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/impact.json")) return new Response(JSON.stringify({ task, artifact: impactArtifact }), { status: 200 });
      if (url.includes("/brief.json")) return new Response(JSON.stringify({ task, brief, section: "summary", items: [], pulse: null, freshness: { sourceSnapshotId: task.latestSnapshotId, current: true } }), { status: 200 });
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const result = await loadTaskWorkbench(route, "token", fetcher);
    expect(result.status).toBe("ready");
    expect(result.payload?.impact).toMatchObject({ status: "ready", value: { conclusion: { status: "paths_observed" }, paths: [{ id: "impact:demo", steps: [{ provenance: [{ filePath: "src/index.ts", lineNumber: 2 }] }] }] } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/tasks/${taskId}/impact.json`), expect.objectContaining({ headers: { accept: "application/json" } }));
  });

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

  it("loads a legacy redacted Repo Pulse Surface", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes("/brief.json")) {
        return new Response("{}", { status: 404 });
      }
      return new Response(JSON.stringify({
        task,
        brief,
        section: "summary",
        items: [],
        pulse: legacyPulse,
        freshness: { sourceSnapshotId: "snapshot:actual", current: true },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const result = await loadTaskWorkbench(route, "token", fetcher);

    expect(result.status).toBe("ready");
    expect(result.payload?.pulse).toEqual(legacyPulse);
    expect(result.payload?.pulse?.strongOperationSupported).toBe(false);
  });

  it("surfaces a missing persisted Task as unavailable", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "task_brief_not_available" }), { status: 404 })) as unknown as typeof fetch;

    const result = await loadTaskWorkbench(route, "token", fetcher);

    expect(result.status).toBe("missing");
    expect(result.message).toContain("No persisted Task Brief");
  });

  it("uses only the HttpOnly-cookie transport and reads the selected Evidence projection", async () => {
    const evidenceId = "evidence:source";
    const cookieRoute = {
      ...route,
      section: "planned_changes",
      findingId: "finding:source",
      evidenceId,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/__workbench/evidence?")) {
        return new Response(JSON.stringify({
          schemaVersion: 1,
          surface: "evidence",
          taskId,
          evidenceId,
          repositoryId: task.repositoryId,
          worktreeId: task.worktreeId,
          snapshotId: task.latestSnapshotId,
          headCommit: null,
          status: "ready",
          evidence: {
            id: evidenceId,
            kind: "source",
            epistemicStatus: "observed",
            freshness: "current",
            nodeIds: ["file:src/index.ts"],
            filePath: "src/index.ts",
            lineRange: [1, 1],
            contentHash: `sha256:${"a".repeat(64)}`,
            observedAtSnapshotId: task.latestSnapshotId,
          },
          source: {
            filePath: "src/index.ts",
            lineRange: [1, 1],
            content: "export const ready = true;",
            sizeBytes: 26,
            lineCount: 1,
            truncated: false,
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("change-check.json") || url.endsWith("verification.json")) {
        return new Response("{}", { status: 404 });
      }
      return new Response(JSON.stringify({
        task,
        brief,
        section: "planned_changes",
        items: [],
        pulse: null,
        freshness: { sourceSnapshotId: task.latestSnapshotId, current: true },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const result = await loadTaskWorkbench(cookieRoute, "__workbench_cookie__", fetcher);

    expect(result.status).toBe("ready");
    expect(result.payload?.evidence).toMatchObject({
      status: "ready",
      value: {
        status: "ready",
        evidenceId,
        evidence: { filePath: "src/index.ts", nodeIds: ["file:src/index.ts"] },
      },
    });
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("token=");
      expect(init).toMatchObject({ credentials: "same-origin" });
    }
  });
});

describe("Task knowledge candidate projection", () => {
  const generationId = `generation-${"a".repeat(64)}`;
  const predecessorGenerationId = `generation-${"b".repeat(64)}`;
  const candidatePayload = {
    schemaVersion: 1,
    taskId,
    currentTaskRevision: 12,
    currentSnapshotId: "snapshot:actual",
    candidates: [{
      candidateGenerationId: generationId,
      taskRevision: 12,
      sourceSnapshotId: "snapshot:actual",
      predecessorGenerationId,
      sourceSnapshotMatchesCurrent: true,
    }],
  };

  it("strictly parses a bounded candidate list and preserves lineage", () => {
    expect(parseTaskKnowledgeCandidates(candidatePayload, taskId)).toEqual(candidatePayload);
    expect(parseTaskKnowledgeCandidates({ ...candidatePayload, candidates: Array(33).fill(candidatePayload.candidates[0]) }, taskId)).toBeNull();
    expect(parseTaskKnowledgeCandidates({ ...candidatePayload, candidates: [{ ...candidatePayload.candidates[0], taskRevision: 13 }] }, taskId)).toBeNull();
    expect(parseTaskKnowledgeCandidates({ ...candidatePayload, candidates: [{ ...candidatePayload.candidates[0] }, { ...candidatePayload.candidates[0] }] }, taskId)).toBeNull();
    expect(parseTaskKnowledgeCandidates({ ...candidatePayload, extra: true }, taskId)).toBeNull();
  });

  it("maps candidate endpoint status and binds the requested Task", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(candidatePayload), { status: 200 })) as unknown as typeof fetch;
    const result = await loadTaskKnowledgeCandidates(route, "token", fetcher);
    expect(result).toMatchObject({ status: "ready", value: candidatePayload });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/tasks/${taskId}/knowledge-candidates.json`),
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );

    for (const [status, expected] of [[404, "missing"], [401, "forbidden"], [409, "stale"], [422, "invalid"], [503, "error"]] as const) {
      const response = await loadTaskKnowledgeCandidates(route, "token", vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch);
      expect(response.status).toBe(expected);
    }
  });
});
