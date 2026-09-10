// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { type ClaimV1, type TaskManifestV1 } from "@understand-code/contracts";
import TaskFirstWorkbench from "../TaskFirstWorkbench";
import TaskEvidencePanel from "../TaskEvidencePanel";
import { launchTaskWorkbench, parseTaskDiscovery } from "../../../workbench/taskDiscovery";
import { loadTaskWorkbench } from "../../../workbench/taskContextLoader";
import { COOKIE_WORKBENCH_ACCESS } from "../../../workbench/transport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const task: TaskManifestV1 = { schemaVersion: 1, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", title: "Inspect a rule", originalIntent: "Explain the deletion", status: "in_progress", repositoryId: "repo:demo", worktreeId: "worktree:demo", baselineSnapshotId: "snapshot:base", latestSnapshotId: "snapshot:current", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z", producerVersion: "0.1.0", revision: 3 };
const claim: ClaimV1 = { id: "claim:goal", taskId: task.taskId, kind: "acceptance", statement: "Removed callers must no longer use the old rule", epistemicStatus: "observed", lifecycleStatus: "supported", freshness: "current", sourceSnapshotId: task.latestSnapshotId, evidenceIds: ["evidence:delete"], findingIds: [], verificationRecordIds: [], createdAt: task.createdAt, updatedAt: task.updatedAt };
const brief = { originalIntent: task.originalIntent, goalClaimId: claim.id, nonGoalClaimIds: [], acceptanceClaimIds: [claim.id], readingPath: [], plannedChanges: [], assumptionClaimIds: [], riskClaimIds: [], unknownClaimIds: [], verificationPlan: [] };
const evidence = { id: "evidence:delete", kind: "source" as const, epistemicStatus: "observed" as const, freshness: "current" as const, filePath: "src/old.ts", lineRange: [1, 1] as const, contentHash: `sha256:${"a".repeat(64)}`, observedAtSnapshotId: task.latestSnapshotId, nodeIds: [] };
const deletion = { status: "ready" as const, taskId: task.taskId, evidenceId: evidence.id, evidence, diff: { oldPath: "src/old.ts", newPath: null, baselineSnapshotId: task.baselineSnapshotId, currentSnapshotId: task.latestSnapshotId, unifiedDiff: "--- a/src/old.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-export const old = true;" } };

describe("task audit user paths", () => {
  it("shows the claim statement and opens its bound evidence", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container); const open = vi.fn();
    await act(async () => root.render(createElement(TaskFirstWorkbench, { route: { view: "tasks", taskId: task.taskId, section: "goals" }, page: { task, brief, claims: [claim], section: "goals", items: [{ kind: "claim_reference", claimId: claim.id, role: "acceptance" }] }, onOpenEvidence: open })));
    expect(container.textContent).toContain(claim.statement);
    expect(container.textContent).toContain("已观察事实");
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-evidence-id="${evidence.id}"]`)?.click());
    expect(open).toHaveBeenCalledWith(undefined, evidence.id);
    await act(async () => root.unmount()); container.remove();
  });
  it("also renders Claim bodies supplied directly by the MCP page projection", () => {
    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, { route: { view: "tasks", taskId: task.taskId, section: "goals" }, page: { task, brief, section: "goals", items: [{ kind: "claim_reference", claimId: claim.id, claim, role: "acceptance" }] } }));
    expect(html).toContain(claim.statement);
    expect(html).not.toContain("此主张正文尚未提供");
  });
  it("labels a prior-snapshot analysis for review when the Task advances without changing its confirmation", () => {
    const analysis = { ...claim, kind: "conclusion" as const, statement: "The task function returns true." };
    const nextTask = { ...task, latestSnapshotId: "snapshot:next", status: "check_required" as const };
    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, { route: { view: "tasks", taskId: task.taskId, section: "summary" }, page: { task: nextTask, brief, section: "summary", claims: [analysis] } }));
    expect(html).toContain(analysis.statement);
    expect(html).toContain("源自先前快照／待复核");
    expect(html).not.toContain("当前快照");
    expect(analysis.lifecycleStatus).toBe("supported");
    expect(analysis.freshness).toBe("current");
  });
  it("renders deletion Diff and provenance when current source no longer exists", () => {
    const html = renderToStaticMarkup(createElement(TaskEvidencePanel, { evidenceId: evidence.id, result: { status: "ready", value: deletion }, relationValid: true, stale: false }));
    expect(html).toContain("-export const old = true;");
    expect(html).toContain("已删除"); expect(html).toContain(evidence.contentHash);
    expect(html).toContain(task.baselineSnapshotId); expect(html).toContain("没有当前源码片段");
  });
  it("accepts deletion evidence without a source and rejects claims from another Task", async () => {
    const payload = { task, brief, claims: [claim], section: "goals", items: [{ kind: "claim_reference", claimId: claim.id, role: "acceptance" }], pulse: null, freshness: { sourceSnapshotId: task.latestSnapshotId, current: true } };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/__workbench/evidence")) return Response.json(deletion);
      if (url.includes("/brief.json")) return Response.json(payload);
      return new Response("{}", { status: 404 });
    });
    const route = { view: "tasks" as const, taskId: task.taskId, section: "goals", evidenceId: evidence.id };
    const result = await loadTaskWorkbench(route, COOKIE_WORKBENCH_ACCESS, fetcher);
    expect(result.status).toBe("ready"); expect(result.payload?.claims[0]?.statement).toBe(claim.statement);
    expect(result.payload?.evidence.value).toEqual(deletion);
    payload.claims = [{ ...claim, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAW" }];
    expect((await loadTaskWorkbench(route, COOKIE_WORKBENCH_ACCESS, fetcher)).status).toBe("invalid");
  });
  it("mints task navigation only on demand and rejects non-loopback launch links", async () => {
    const fetcher = vi.fn(async () => Response.json({ deepLink: "http://127.0.0.1:43123/workbench?view=tasks&taskId=example" }));
    const result = await launchTaskWorkbench(task.taskId, COOKIE_WORKBENCH_ACCESS, "http://127.0.0.1:41000", fetcher);
    expect(result.status).toBe("ready");
    expect(fetcher).toHaveBeenCalledWith(`/__workbench/tasks/${task.taskId}/open`, expect.objectContaining({ credentials: "same-origin" }));
    for (const deepLink of ["https://example.com/workbench", "http://127.0.0.1:43123/other", "http://127.0.0.1.evil.test/workbench"]) {
      expect((await launchTaskWorkbench(task.taskId, COOKIE_WORKBENCH_ACCESS, "http://127.0.0.1:41000", async () => Response.json({ deepLink }))).status).toBe("unavailable");
    }
  });
  it("keeps task discovery repository-bound and validates runtime status", () => {
    const discovery = { schemaVersion: 1, repository: { repoId: task.repositoryId, name: "example-repo", status: "fresh" }, runtime: { kind: "local", ready: true }, tasks: [task] };
    expect(parseTaskDiscovery(discovery)?.tasks[0]?.taskId).toBe(task.taskId);
    expect(parseTaskDiscovery(discovery)?.repository.name).toBe("example-repo");
    expect(parseTaskDiscovery({ ...discovery, repository: { ...discovery.repository, name: 42 } })).toBeNull();
    expect(parseTaskDiscovery({ ...discovery, repository: { repoId: "repo:other", status: "fresh" } })).toBeNull();
    expect(parseTaskDiscovery({ ...discovery, runtime: { kind: "local", ready: "true" } })).toBeNull();
  });
});
