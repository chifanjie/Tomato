// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const projection = {
  task: {
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
  },
  brief: {
    originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
    goalClaimId: "claim:goal",
    nonGoalClaimIds: [],
    acceptanceClaimIds: ["claim:acceptance"],
    readingPath: [],
    plannedChanges: [],
    assumptionClaimIds: [],
    riskClaimIds: [],
    unknownClaimIds: [],
    verificationPlan: [],
  },
  section: "summary",
  items: [{
    kind: "summary",
    originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
    goalClaimId: "claim:goal",
    acceptanceClaimCount: 1,
    plannedChangeCount: 0,
  }],
  pulse: null,
  freshness: { sourceSnapshotId: "snapshot:actual", current: true },
};

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  try { window.localStorage?.clear(); } catch { /* storage is optional in happy-dom */ }
  try { window.sessionStorage?.clear(); } catch { /* storage is optional in happy-dom */ }
  vi.restoreAllMocks();
});

describe("Task-first Preview host bridge", () => {
  it("renders the real persisted Task projection on a Task deep link", async () => {
    window.history.replaceState(null, "", `/tasks/${taskId}?token=preview-token`);
    vi.stubGlobal("fetch", vi.fn(async () => response(200, projection)));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="task-first-workbench"]')).not.toBeNull();
    expect(container.textContent).toContain("Preserve evidence across Agent handoffs");
    expect(container.textContent).toContain("Read-only");
    await act(async () => root.unmount());
  });

  it("keeps an unavailable persisted Task in the explicit failure state", async () => {
    window.history.replaceState(null, "", `/tasks/${taskId}?token=preview-token`);
    vi.stubGlobal("fetch", vi.fn(async () => response(404, { error: "task_brief_not_available" })));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="task-first-workbench"]')).not.toBeNull();
    expect(container.textContent).toContain("Unable to load Task Brief");
    await act(async () => root.unmount());
  });
});
